import { query, withTransaction } from "../db/connection";
import {
  generatePresignedUploadUrl,
  generatePresignedPlaybackUrl,
  deleteAudioFile,
  getAudioMetadata,
  type PresignedUploadResult,
} from "../storage/s3-service";
import { recordAuditLog } from "./audit.service";

export interface StartSessionParams {
  consultationId: string;
  doctorId: string;
  formatAudio?: string;
}

export interface FinishSessionParams {
  sessionId: string;
  durationSeconds: number;
  audioQualityScore?: number;
  checksumSha256?: string;
  doctorId?: string;
}

export interface TranscriptSegmentItem {
  speakerRole: "Dokter" | "Pasien" | "Keluarga" | "Lainnya";
  timeOffset: string;
  text: string;
  confidenceScore?: number;
}

/**
 * Service orchestrating Voice Scribe Audio Processing, Object Storage, and Transcription.
 */
export class VoiceScribeService {
  /**
   * 1. Start a voice recording session:
   * - Generates S3 pre-signed upload URL
   * - Records session metadata in PostgreSQL with 'RECORDING' status
   * - Logs audit trail
   */
  static async startRecordingSession({
    consultationId,
    doctorId,
    formatAudio = "audio/webm",
  }: StartSessionParams): Promise<{
    sessionId: string;
    upload: PresignedUploadResult;
  }> {
    const ext = formatAudio.includes("wav") ? "wav" : "webm";
    const upload = await generatePresignedUploadUrl({
      consultationId,
      fileExtension: ext,
      mimeType: formatAudio,
    });

    // Upsert recording session record in PostgreSQL
    const sql = `
      INSERT INTO rekaman_audio (
        id_konsultasi, lokasi_file, bucket_name, format_audio, status_transkripsi, status_retensi
      ) VALUES ($1, $2, $3, $4, 'RECORDING', 'AKTIF')
      ON CONFLICT (id_konsultasi) DO UPDATE SET
        lokasi_file = EXCLUDED.lokasi_file,
        format_audio = EXCLUDED.format_audio,
        status_transkripsi = 'RECORDING',
        status_retensi = 'AKTIF',
        direkam_pada = CURRENT_TIMESTAMP
      RETURNING id_rekaman;
    `;

    const res = await query<{ id_rekaman: string }>(sql, [
      consultationId,
      upload.s3Key,
      upload.bucketName,
      formatAudio,
    ]);

    const sessionId = res.rows[0].id_rekaman;

    // Update consultation status to 'Diperiksa'
    await query(`UPDATE konsultasi SET status = 'Diperiksa' WHERE id_konsultasi = $1`, [
      consultationId,
    ]);

    await recordAuditLog({
      doctorId,
      consultationId,
      action: "MULAI_REKAM",
      details: `Memulai sesi perekaman suara medis S3 key: ${upload.s3Key}`,
    });

    return { sessionId, upload };
  }

  /**
   * 2. Finalize recording session:
   * - Verifies uploaded file metadata from S3
   * - Updates recording duration and status to 'COMPLETED'
   */
  static async finishRecordingSession({
    sessionId,
    durationSeconds,
    audioQualityScore = 92,
    checksumSha256,
    doctorId,
  }: FinishSessionParams): Promise<void> {
    const sessionRes = await query<{ lokasi_file: string; id_konsultasi: string }>(
      `SELECT lokasi_file, id_konsultasi FROM rekaman_audio WHERE id_rekaman = $1`,
      [sessionId],
    );

    if (sessionRes.rows.length === 0) {
      throw new Error("Recording session not found");
    }

    const { lokasi_file, id_konsultasi } = sessionRes.rows[0];

    // Check size in S3
    const s3Meta = await getAudioMetadata(lokasi_file);
    const byteSize = s3Meta?.contentLength ?? 0;

    await query(
      `UPDATE rekaman_audio
       SET durasi_detik = $1,
           ukuran_byte = $2,
           kualitas_audio = $3,
           checksum_sha256 = COALESCE($4, checksum_sha256),
           status_transkripsi = 'COMPLETED'
       WHERE id_rekaman = $5`,
      [durationSeconds, byteSize, audioQualityScore, checksumSha256 ?? null, sessionId],
    );

    // Update consultation to 'Menunggu Review'
    await query(`UPDATE konsultasi SET status = 'Menunggu Review' WHERE id_konsultasi = $1`, [
      id_konsultasi,
    ]);

    await recordAuditLog({
      doctorId,
      consultationId: id_konsultasi,
      action: "SELESAI_REKAM",
      details: `Perekaman selesai. Durasi: ${durationSeconds} detik, Ukuran: ${byteSize} bytes, Kualitas: ${audioQualityScore}%`,
    });
  }

  /**
   * 3. Save transcript conversation segments into PostgreSQL.
   */
  static async saveTranscriptSegments(
    sessionId: string,
    segments: TranscriptSegmentItem[],
  ): Promise<void> {
    await withTransaction(async (client) => {
      // Clear previous draft segments for this session if re-transcribing
      await client.query(`DELETE FROM transkrip WHERE id_rekaman = $1`, [sessionId]);

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        await client.query(
          `INSERT INTO transkrip (id_rekaman, urutan, peran_pembicara, offset_waktu, teks_transkrip, confidence_rata_rata)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            sessionId,
            i + 1,
            seg.speakerRole,
            seg.timeOffset,
            seg.text,
            seg.confidenceScore ?? 0.95,
          ],
        );
      }
    });
  }

  /**
   * 4. Generate audio playback URL for doctor to review recording.
   */
  static async getPlaybackUrl(sessionId: string): Promise<string> {
    const res = await query<{ lokasi_file: string; status_retensi: string }>(
      `SELECT lokasi_file, status_retensi FROM rekaman_audio WHERE id_rekaman = $1`,
      [sessionId],
    );

    if (res.rows.length === 0) {
      throw new Error("Recording session not found");
    }

    if (res.rows[0].status_retensi === "DIHAPUS_PERMANEN") {
      throw new Error("Audio file has been purged for privacy compliance (UU PDP)");
    }

    return await generatePresignedPlaybackUrl(res.rows[0].lokasi_file);
  }

  /**
   * 5. Purge audio file from Object Storage for healthcare privacy (UU PDP).
   * Called automatically after doctor approves the clinical record or when retention expires.
   */
  static async purgeAudioSession(sessionId: string, doctorId?: string): Promise<boolean> {
    const res = await query<{ lokasi_file: string; id_konsultasi: string }>(
      `SELECT lokasi_file, id_konsultasi FROM rekaman_audio WHERE id_rekaman = $1`,
      [sessionId],
    );

    if (res.rows.length === 0) return false;

    const { lokasi_file, id_konsultasi } = res.rows[0];

    // Delete object from S3
    const deleted = await deleteAudioFile(lokasi_file);

    if (deleted) {
      await query(
        `UPDATE rekaman_audio 
         SET status_retensi = 'DIHAPUS_PERMANEN',
             dihapus_pada = CURRENT_TIMESTAMP
         WHERE id_rekaman = $1`,
        [sessionId],
      );

      await recordAuditLog({
        doctorId,
        consultationId: id_konsultasi,
        action: "HAPUS_AUDIO_PRIVASI",
        details: `File audio rekaman dihapus permanen dari S3 untuk perlindungan data pribadi pasien.`,
      });
    }

    return deleted;
  }
}
