export function findBuiltInPortEvidence(blocks, fieldName) {
  const pattern = fieldName === "hasHDMI"
    ? /^HDMI\s*(?:端口|接口|連接埠)$/
    : fieldName === "hasSDXC" ? /^SDXC\s*(?:卡插槽|插槽|读卡器|讀卡器)$/ : null;
  return pattern ? blocks.find((block) => pattern.test(block.trim())) ?? null : null;
}
