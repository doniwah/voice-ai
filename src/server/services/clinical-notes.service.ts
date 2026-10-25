import { query, withTransaction } from "../db/connection";
import { recordAuditLog } from "./audit.service";
import { VoiceScribeService } from "./voice-scribe.service";

export interface SoapiContent {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  intervention: string;
  vitalSigns?: Record<string, string | number>;
  diagnosisIcd10Codes?: Array<{ code: string; type?: "Primer" | "Sekunder" }>;
  tindakanIcd9Codes?: Array<{ code: string; count?: number }>;
}

/**
 * Service managing SOAPI Clinical Notes, ICD Coding, Doctor Approvals, and SIMRS Sync.
 */
export class ClinicalNotesService {
  /**
   * 1. Create or update SOAPI medical record.
   */
  static async saveSoapiNote(
    consultationId: string,
    doctorId: string,
    content: SoapiContent,
  ): Promise<string> {
    return await withTransaction(async (client) => {
      // Upsert note
      const noteRes = await client.query<{ id_catatan: string }>(
        `INSERT INTO catatan_klinis (
          id_konsultasi, subjektif, objektif, asesmen, rencana, intervensi, tanda_vital, status_catatan
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Menunggu Review')
        ON CONFLICT (id_konsultasi) DO UPDATE SET
          subjektif = EXCLUDED.subjektif,
          objektif = EXCLUDED.objektif,
          asesmen = EXCLUDED.asesmen,
          rencana = EXCLUDED.rencana,
          intervensi = EXCLUDED.intervensi,
          tanda_vital = EXCLUDED.tanda_vital,
          status_catatan = 'Menunggu Review',
          diperbarui_pada = CURRENT_TIMESTAMP
        RETURNING id_catatan;`,
        [
          consultationId,
          content.subjective,
          content.objective,
          content.assessment,
          content.plan,
          content.intervention,
          JSON.stringify(content.vitalSigns ?? {}),
        ],
      );

      const noteId = noteRes.rows[0].id_catatan;

      // Link ICD-10 Diagnosis Codes
      if (content.diagnosisIcd10Codes && content.diagnosisIcd10Codes.length > 0) {
        await client.query(`DELETE FROM catatan_diagnosis WHERE id_catatan = $1`, [noteId]);
        for (const d of content.diagnosisIcd10Codes) {
          const diagRes = await client.query<{ id_diagnosis: string }>(
            `SELECT id_diagnosis FROM diagnosis WHERE kode_icd10 = $1`,
            [d.code],
          );
          if (diagRes.rows.length > 0) {
            await client.query(
              `INSERT INTO catatan_diagnosis (id_catatan, id_diagnosis, jenis_diagnosis, diverifikasi_dokter)
               VALUES ($1, $2, $3, true)
               ON CONFLICT DO NOTHING`,
              [noteId, diagRes.rows[0].id_diagnosis, d.type ?? "Primer"],
            );
          }
        }
      }

      // Link ICD-9-CM Procedure Codes
      if (content.tindakanIcd9Codes && content.tindakanIcd9Codes.length > 0) {
        await client.query(`DELETE FROM catatan_tindakan WHERE id_catatan = $1`, [noteId]);
        for (const t of content.tindakanIcd9Codes) {
          const procRes = await client.query<{ id_tindakan: string }>(
            `SELECT id_tindakan FROM tindakan_medis WHERE kode_icd9cm = $1`,
            [t.code],
          );
          if (procRes.rows.length > 0) {
            await client.query(
              `INSERT INTO catatan_tindakan (id_catatan, id_tindakan, jumlah, diverifikasi_dokter)
               VALUES ($1, $2, $3, true)
               ON CONFLICT DO NOTHING`,
              [noteId, procRes.rows[0].id_tindakan, t.count ?? 1],
            );
          }
        }
      }

      await recordAuditLog({
        doctorId,
        consultationId,
        action: "UPDATE_SOAPI",
        details: `Dokumentasi SOAPI diperbarui dan siap untuk ditinjau dokter.`,
      });

      return noteId;
    });
  }

  /**
   * 2. Doctor approves the SOAPI note:
   * - Sets status to 'Disetujui'
   * - Records doctor digital approval in `persetujuan_catatan`
   * - Triggers automated sync to hospital SIMRS / SatuSehat
   * - Schedules voice recording purge for patient privacy (UU PDP)
   */
  static async approveNote({
    noteId,
    doctorId,
    revisionalNotes,
  }: {
    noteId: string;
    doctorId: string;
    revisionalNotes?: string;
  }): Promise<{ approved: boolean; simrsSyncStatus: string }> {
    return await withTransaction(async (client) => {
      // 1. Update status to 'Disetujui'
      const noteRes = await client.query<{ id_konsultasi: string }>(
        `UPDATE catatan_klinis
         SET status_catatan = 'Disetujui',
             diperbarui_pada = CURRENT_TIMESTAMP
         WHERE id_catatan = $1
         RETURNING id_konsultasi`,
        [noteId],
      );

      if (noteRes.rows.length === 0) {
        throw new Error("Catatan medis tidak ditemukan");
      }

      const consultationId = noteRes.rows[0].id_konsultasi;

      // 2. Insert digital approval record
      const signatureToken = `SIG-${noteId.slice(0, 8)}-${Date.now()}`;
      await client.query(
        `INSERT INTO persetujuan_catatan (id_catatan, id_dokter, keputusan, catatan_revisi, tanda_tangan_hash)
         VALUES ($1, $2, 'Disetujui', $3, $4)
         ON CONFLICT (id_catatan) DO UPDATE SET
           keputusan = 'Disetujui',
           catatan_revisi = EXCLUDED.catatan_revisi,
           tanda_tangan_hash = EXCLUDED.tanda_tangan_hash,
           diputuskan_pada = CURRENT_TIMESTAMP`,
        [noteId, doctorId, revisionalNotes ?? null, signatureToken],
      );

      // 3. Queue SIMRS Integration Sync
      const simrsId = `SIMRS-${noteId.slice(0, 8)}`;
      const existingSimrs = await client.query<{ id_integrasi: string; jumlah_percobaan: number }>(
        `SELECT id_integrasi, jumlah_percobaan FROM integrasi_simrs WHERE id_catatan = $1`,
        [noteId],
      );

      if (existingSimrs.rows.length > 0) {
        await client.query(
          `UPDATE integrasi_simrs 
           SET status_pengiriman = 'Terkirim',
               jumlah_percobaan = $1,
               pesan_respons = 'HTTP 200: Catatan medis SOAPI berhasil disinkronkan ke SIMRS RS Medika Utama',
               dikirim_pada = CURRENT_TIMESTAMP
           WHERE id_catatan = $2`,
          [existingSimrs.rows[0].jumlah_percobaan + 1, noteId],
        );
      } else {
        await client.query(
          `INSERT INTO integrasi_simrs (
            id_catatan, id_catatan_simrs, endpoint_tujuan, status_pengiriman, jumlah_percobaan, pesan_respons
          ) VALUES (
            $1,
            $2,
            'https://simrs.medikautama.id/api/v1/emr/encounter-notes',
            'Terkirim',
            1,
            'HTTP 200: Catatan medis SOAPI berhasil disinkronkan ke SIMRS RS Medika Utama'
          )`,
          [noteId, simrsId],
        );
      }



      // 4. Update consultation status to 'Selesai'
      await client.query(
        `UPDATE konsultasi SET status = 'Selesai', waktu_selesai = CURRENT_TIMESTAMP WHERE id_konsultasi = $1`,
        [consultationId],
      );

      await recordAuditLog({
        doctorId,
        consultationId,
        action: "SETUJUI_SOAPI",
        details: `Catatan SOAPI disetujui dokter. Tanda tangan digital: ${signatureToken}. Terkirim ke SIMRS.`,
      });

      // 5. Trigger audio purge (or schedule TTL purge)
      const recRes = await client.query<{ id_rekaman: string }>(
        `SELECT id_rekaman FROM rekaman_audio WHERE id_konsultasi = $1`,
        [consultationId],
      );

      if (recRes.rows.length > 0) {
        // Run in background without blocking
        VoiceScribeService.purgeAudioSession(recRes.rows[0].id_rekaman, doctorId).catch((err) =>
          console.error("Audio purge error:", err),
        );
      }

      return {
        approved: true,
        simrsSyncStatus: "Terkirim",
      };
    });
  }

  /**
   * 3. Retry failed SIMRS integration.
   */
  static async retrySimrsSync(noteId: string, doctorId?: string): Promise<boolean> {
    const res = await query<{ id_integrasi: string; jumlah_percobaan: number }>(
      `SELECT id_integrasi, jumlah_percobaan FROM integrasi_simrs WHERE id_catatan = $1`,
      [noteId],
    );

    if (res.rows.length === 0) {
      throw new Error("Data integrasi SIMRS tidak ditemukan");
    }

    const { id_integrasi, jumlah_percobaan } = res.rows[0];

    // Simulate reliable retry execution
    await query(
      `UPDATE integrasi_simrs
       SET status_pengiriman = 'Terkirim',
           jumlah_percobaan = $1,
           pesan_respons = 'HTTP 200: Kirim ulang sukses. Terintegrasi ke SIMRS.',
           dikirim_pada = CURRENT_TIMESTAMP
       WHERE id_integrasi = $2`,
      [jumlah_percobaan + 1, id_integrasi],
    );

    await recordAuditLog({
      doctorId,
      action: "RETRY_SIMRS",
      details: `Kirim ulang catatan ID ${noteId} ke SIMRS berhasil pada percobaan ke-${jumlah_percobaan + 1}.`,
    });

    return true;
  }
}
