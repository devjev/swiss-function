import type { PointSeries } from "../../lib/chart3d/types";
import { PointCloud } from "./PointCloud";

const series: PointSeries[] = [
  {
    name: "A",
    color: "var(--sf-color-primary)",
    data: Array.from({ length: 30 }, (_, k) => ({ x: k % 5, y: (k * 3) % 7, z: (k * 2) % 4 })),
  },
  {
    name: "B",
    color: "var(--sf-color-success)",
    data: Array.from({ length: 30 }, (_, k) => ({
      x: 5 + (k % 4),
      y: (k * 2) % 6,
      z: 3 + (k % 3),
    })),
  },
];

export function PointCloudHarness() {
  return (
    <div style={{ width: 360 }}>
      <PointCloud series={series} />
    </div>
  );
}
