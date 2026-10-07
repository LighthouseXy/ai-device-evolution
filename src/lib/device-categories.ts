export const deviceCategories = ["phone", "tablet", "laptop", "watch", "band"] as const;
export type DeviceCategory = (typeof deviceCategories)[number];

export const categoryLabels: Record<DeviceCategory, string> = {
  phone: "手机",
  tablet: "平板电脑",
  laptop: "笔记本电脑",
  watch: "手表",
  band: "手环",
};
