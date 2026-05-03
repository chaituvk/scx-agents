import { query, getOne, run } from "@/lib/db";
import { Repository } from "./base";

export interface VoiceSim {
  id: string;
  tenant_id?: string;
  name: string;
  noise_level?: string | null;
  speaker_type?: string | null;
  transcript?: string | null;
  confidence?: number | null;
  accuracy?: number | null;
  status: string;
  created_at?: string;
}

class VoiceSimRepo extends Repository<VoiceSim> {
  constructor() {
    super("voice_sims", 300);
  }

  async findById(id: string): Promise<VoiceSim | null> {
    const row = await getOne("SELECT * FROM voice_sims WHERE id = $1", [id]);
    return row as VoiceSim | null;
  }

  async findAll(tenantId?: string): Promise<VoiceSim[]> {
    const result = tenantId
      ? await query("SELECT * FROM voice_sims WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200", [tenantId])
      : await query("SELECT * FROM voice_sims ORDER BY created_at DESC LIMIT 200");
    return result.rows as VoiceSim[];
  }

  async create(data: Omit<VoiceSim, "id" | "created_at"> & { id?: string }): Promise<VoiceSim> {
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();

    await run(
      `INSERT INTO voice_sims (id, tenant_id, name, noise_level, speaker_type, transcript, confidence, accuracy, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, data.tenant_id ?? "r-mobile", data.name, data.noise_level ?? null, data.speaker_type ?? null, data.transcript ?? null, data.confidence ?? null, data.accuracy ?? null, data.status ?? "pending", now]
    );

    return { ...data, id, created_at: now } as VoiceSim;
  }

  async update(id: string, data: Partial<VoiceSim>): Promise<VoiceSim | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined && k !== "id" && k !== "created_at") {
        fields.push(`${k} = $${idx}`);
        values.push(v);
        idx++;
      }
    }
    if (fields.length === 0) return this.findById(id);

    values.push(id);
    await run(`UPDATE voice_sims SET ${fields.join(", ")} WHERE id = $${idx}`, values);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await run("DELETE FROM voice_sims WHERE id = $1", [id]);
    return (result.changes || 0) > 0;
  }
}

export const voiceSimRepo = new VoiceSimRepo();
