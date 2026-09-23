/**
 * Vendor-neutral storage planning model.
 *
 * This is a planning calculation only. It does not read browser storage, claim
 * that bytes exist, or replace a backend usage/quota report. The inputs are
 * explicit so an academy can replace assumptions with measured telemetry later.
 */
export interface StorageEstimateInput {
  students: number;
  uploadsPerStudent: number;
  averageStudentUploadBytes: number;
  events: number;
  imagesPerEvent: number;
  averageEventImageBytes: number;
  monthlyAudioVideoGrowthBytes: number;
  existingBytes?: number;
  projectionMonths?: number;
}

export interface StorageEstimate {
  studentUploadsBytes: number;
  eventImagesBytes: number;
  monthlyGrowthBytes: number;
  existingBytes: number;
  projectedBytes: number;
}

function nonNegative(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

/** Returns a transparent byte estimate without choosing a storage vendor. */
export function estimateStorage(input: StorageEstimateInput): StorageEstimate {
  const studentUploadsBytes =
    nonNegative(input.students) * nonNegative(input.uploadsPerStudent) * nonNegative(input.averageStudentUploadBytes);
  const eventImagesBytes =
    nonNegative(input.events) * nonNegative(input.imagesPerEvent) * nonNegative(input.averageEventImageBytes);
  const monthlyGrowthBytes = nonNegative(input.monthlyAudioVideoGrowthBytes);
  const existingBytes = nonNegative(input.existingBytes);
  const months = nonNegative(input.projectionMonths);

  return {
    studentUploadsBytes,
    eventImagesBytes,
    monthlyGrowthBytes,
    existingBytes,
    projectedBytes: existingBytes + studentUploadsBytes + eventImagesBytes + monthlyGrowthBytes * months,
  };
}
