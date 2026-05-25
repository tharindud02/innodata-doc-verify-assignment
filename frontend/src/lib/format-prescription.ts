import type { Entity } from "@/types/api";

/** Human-readable single-line prescription from structured entity fields. */
export function formatPrescription(entity: Entity): string {
  const dosePart = [entity.dose, entity.unit].filter(Boolean).join(" ");
  const parts = [
    entity.drugName,
    dosePart || null,
    entity.frequency,
    entity.duration ? `for ${entity.duration}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

export function formatPrescriptionSubtitle(entity: Entity): string | null {
  const bits = [
    entity.route,
    entity.indication,
    entity.sourcePage != null ? `p. ${entity.sourcePage}` : null,
  ].filter(Boolean);
  return bits.length > 0 ? bits.join(" · ") : null;
}
