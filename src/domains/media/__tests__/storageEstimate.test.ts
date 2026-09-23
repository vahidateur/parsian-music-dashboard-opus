import { describe, expect, it } from "vitest";
import { estimateStorage } from "../storageEstimate";

describe("estimateStorage", () => {
  it("keeps student uploads, event images, and monthly growth transparent", () => {
    expect(
      estimateStorage({
        students: 10,
        uploadsPerStudent: 2,
        averageStudentUploadBytes: 100,
        events: 3,
        imagesPerEvent: 4,
        averageEventImageBytes: 50,
        monthlyAudioVideoGrowthBytes: 500,
        existingBytes: 1_000,
        projectionMonths: 2,
      }),
    ).toEqual({
      studentUploadsBytes: 2_000,
      eventImagesBytes: 600,
      monthlyGrowthBytes: 500,
      existingBytes: 1_000,
      projectedBytes: 4_600,
    });
  });

  it("does not turn invalid or negative assumptions into negative storage", () => {
    expect(
      estimateStorage({
        students: -1,
        uploadsPerStudent: Number.NaN,
        averageStudentUploadBytes: 100,
        events: 2,
        imagesPerEvent: -4,
        averageEventImageBytes: 50,
        monthlyAudioVideoGrowthBytes: Number.POSITIVE_INFINITY,
        existingBytes: -10,
        projectionMonths: -2,
      }),
    ).toEqual({
      studentUploadsBytes: 0,
      eventImagesBytes: 0,
      monthlyGrowthBytes: 0,
      existingBytes: 0,
      projectedBytes: 0,
    });
  });
});
