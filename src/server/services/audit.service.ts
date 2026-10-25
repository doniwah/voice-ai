import { query } from "../db/connection";

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "MULAI_REKAM"
  | "SELESAI_REKAM"
  | "REVIEW_SOAPI"
  | "UPDATE_SOAPI"
  | "SETUJUI_SOAPI"
  | "SYNC_SIMRS"
  | "RETRY_SIMRS"
  | "HAPUS_AUDIO_PRIVASI";

export interface CreateAuditLogParams {
  doctorId?: string;
  consultationId?: string;
  action: AuditAction;
  details: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Immutable Audit Logger Service.
 * Implements legal requirement for tracking all electronic medical record access.
 */
export async function recordAuditLog({
  doctorId,
  consultationId,
  action,
  details,
  ipAddress,
  userAgent,
}: CreateAuditLogParams): Promise<void> {
  try {
    await query(
      `INSERT INTO riwayat_aktivitas (id_dokter, id_konsultasi, jenis_aktivitas, detail_aktivitas, alamat_ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        doctorId ?? null,
        consultationId ?? null,
        action,
        details,
        ipAddress ?? null,
        userAgent ?? null,
      ],
    );
  } catch (error) {
    // Audit log write failure is logged to console; does not crash primary business flow
    console.error("❌ Failed to write audit log:", error);
  }
}
