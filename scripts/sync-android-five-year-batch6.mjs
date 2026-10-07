import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { importZolSeries, plainText, zolRows, readSingleCapacity } from "./lib/zol-device.mjs";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";
import { readOfficialColorGallery } from "./lib/device-images.mjs";
import { readOppoShopData } from "./lib/android-official-specs.mjs";

const fixture = JSON.parse(await fs.readFile(new URL("./fixtures/android-five-year-batch6.json", import.meta.url), "utf8"));
const options = { offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh") };
const checkOnly = process.argv.includes("--check");
const manifest = JSON.parse(await fs.readFile(new URL("../src/data/device-data-manifest.json", import.meta.url), "utf8"));
const prior = await Promise.all(["oppo", "vivo", "honor"].map(async slug => JSON.parse(await fs.readFile(new URL(`../src/data/${slug}-five-year-batch5-devices-db.json`, import.meta.url), "utf8"))));
const existing = [], existingSources = [];
for (const row of manifest.datasets.filter(r => ["OPPO", "vivo", "HONOR"].includes(r.brand) && !r.devices.includes("batch6"))) {
  existing.push(...JSON.parse(await fs.readFile(new URL(`../src/data/${row.devices}`, import.meta.url), "utf8")).devices);
  existingSources.push(...Object.values(JSON.parse(await fs.readFile(new URL(`../src/data/${row.sources}`, import.meta.url), "utf8"))).flat());
}
const compact = s => s.replace(/[\s()（）]/g, "").toLowerCase();
const title = p => plainText(p.html.match(/<title[^>]*>([^]*?)<\/title>/i)?.[1] ?? "");
const evidence = (p, value, rawText, official = true, unit) => ({ value, ...(unit ? { unit } : {}), rawText, evidenceKind: "excerpt", sourceUrl: p.url, sourceType: official ? "official" : "reference", confidence: official ? 1 : 0.8, verifiedAt: p.fetchedAt.slice(0, 10), fetchedAt: p.fetchedAt, sourceSnapshotHash: p.sha256 });
const license = { licenseStatus: "unknown", licenseNote: "公开产品身份和原页URL已核验；未取得版权授权或商业转载许可。" };
const required = ["chip", "memory", "storage", "launchPrice", "screenSize", "displayType", "resolution", "port", "rearCamera", "frontCamera"];
const devices = [], sources = [], blocked = [], processed = new Set();
assert.ok(fixture.targets.length >= 8 && fixture.targets.length <= 16);
assert.equal(new Set(fixture.targets.map(t => t.id)).size, fixture.targets.length);

function vivoRows(p) {
  const rows = new Map();
  for (const [, block] of p.html.matchAll(/<li\b[^>]*class="attr-item[^"]*"[^>]*>([^]*?)<\/li>/g)) {
    const key = plainText(block.match(/<p[^>]*class="attr-item-name"[^>]*>([^]*?)<\/p>/)?.[1] ?? "");
    const value = plainText(block.match(/class="more-text-content"[^>]*>([^]*)/)?.[1] ?? "");
    if (key && value) rows.set(key, value);
  }
  return rows;
}
function shopData(p) {
  return readOppoShopData(p.html);
}
function staticText(p) {
  // Preserve original bytes/hash; decoded literal text is only a verification
  // view of the serialized SSR data, never a rewritten/sanitized snapshot.
  return plainText(p.html) + " " + [...p.html.matchAll(/"(?:\\.|[^"\\])*"/g)].flatMap(m => { try { return [JSON.parse(m[0])]; } catch { return []; } }).join(" ");
}
function readCore(p, rows, mapping) {
  const specs = {};
  for (const [field, label, convert, unit] of mapping) {
    const raw = rows.get(label), value = raw && (convert ? convert(raw) : raw);
    if (value !== undefined && value !== null && value !== "" && !(typeof value === "number" && !Number.isFinite(value))) specs[field] = evidence(p, value, raw, true, unit);
  }
  return specs;
}
const number = raw => Number(raw.match(/\d+(?:\.\d+)?/)?.[0]);
const refresh = raw => Math.max(...[...raw.matchAll(/(\d+)\s*Hz/g)].map(m => Number(m[1])));
const battery = raw => Number(raw.match(/典型(?:值|容量)[：:]\s*(\d+)\s*mAh/)?.[1] ?? raw.match(/(\d+)\s*mAh[^；]*?典型/)?.[1]);
async function actualRelease(row, source) {
  const p = await getSourceSnapshot(row.release.url, options), raw = plainText(p.html).match(new RegExp(row.release.pattern))?.[0];
  assert.ok(raw && row.release.date.slice(0, 4) === String(row.releaseYear) && row.release.date <= fixture.asOf, "实际首售来源或年份/截至范围不符");
  assert.ok(plainText(p.html).match(new RegExp(`${row.releaseYear}[/-]\\d{1,2}[/-]\\d{1,2}`)), "报道缺准确发布年份");
  source.releaseEvidence = evidence(p, row.release.precision === "year" ? String(row.releaseYear) : row.release.date, raw, false);
  source.releaseDatePrecision = row.release.precision ?? "day"; source.referenceUrls.push(p.url);
  if (row.release.corroboration) {
    const c = await getSourceSnapshot(row.release.corroboration.url, options), text = plainText(c.html).match(new RegExp(row.release.corroboration.pattern))?.[0]; assert.ok(text);
    source.releaseCorroboration = evidence(c, row.release.date, text, false); source.referenceUrls.push(c.url);
  }
  if (row.release.conflicts) {
    source.releaseDateConflicts = [];
    for (const c of row.release.conflicts) { const page = await getSourceSnapshot(c.url, options), text = plainText(page.html).match(new RegExp(c.pattern))?.[0]; assert.ok(text); source.releaseDateConflicts.push(evidence(page, c.date, text, false)); source.referenceUrls.push(page.url); }
    source.notes += " 开售报道日期冲突，仅保留2024年精度，不选择任意日；官网上市月份不当首售日。";
  }
}
for (const row of fixture.targets) {
  assert.ok(!existing.some(d => d.id === row.id || compact(d.modelName) === compact(row.modelName)), row.id + ": 与当前manifest实际身份重复");
  processed.add(row.inventoryId ?? row.id);
  try {
    const base = row.officialName ?? row.modelName, variant = row.variant ?? "standard";
    let p, configurations, specs, source, device, gallery, excludedEditionColors=[];
    if (row.param || row.shopId) {
      p = await getSourceSnapshot(row.param ? "https://www.vivo.com.cn/vivo/param/" + row.param : `https://www.opposhop.cn/cn/web/products/${row.shopId}.html`, options);
      assert.ok(compact(title(p)).includes(compact(base)), "中国官网型号身份不符");
      let rows, skuRaw;
      if (row.param) {
        rows = vivoRows(p); skuRaw = plainText(p.html).match(/上市价格 ([^]*?)(?=上市时间)/)?.[1]; assert.ok(skuRaw);
        if (row.skuEnd) skuRaw = skuRaw.split(row.skuEnd)[0];
        const matches = [...skuRaw.matchAll(/(?:vivo Pad[^（]*?|iQOO Pad[^（]*?)?(?:[（(])?(\d+GB)\+(\d+(?:GB|TB))[）)]?[：:](\d+(?:\.\d+)?)元/g)];
        configurations = matches.filter(m => Boolean(m[0].includes("柔光版")) === Boolean(row.softLight)).map(m => ({ memory: m[1], storage: m[2], evidence: evidence(p, m[1] + " + " + m[2], m[0]) }));
        specs = readCore(p, rows, [["chip","CPU型号"],["memoryType","RAM类型"],["storageType","ROM类型"],["screenSize","尺寸（英寸）",number,"inch"],["displayType","屏幕材质"],["resolution","分辨率"],["refreshRate","刷新率",refresh,"Hz"],["batteryCapacity","电池容量",battery,"mAh"],["rearCamera","后置"],["frontCamera","前置"],["port","充电接口"],["chargingMethod","充电规格"],["hasNFC","NFC",v => v === "支持" ? true : v === "不支持" ? false : undefined],["weight","重量",v => number(v.match(row.softLight ? /(\d+(?:\.\d+)?)g[（(]柔光版/ : /(\d+(?:\.\d+)?)g[（(]标准版/)?.[0] ?? (/^\d+(?:\.\d+)?g$/.test(v) ? v : "")),"g"]]);
        const os = plainText(p.html).match(/操作系统 (?:OS版本[：:]\s*)?([^]*?)(?=功能应用|$)/)?.[1]; if (os) specs.operatingSystem = evidence(p, os, os);
        gallery = readOfficialColorGallery(p.html, { brand:row.brand, modelName:base }, p.url);
      } else {
        const data = shopData(p); assert.equal(data.goodsSpuName, base);
        rows = new Map(data.baseAttributes.flatMap(g => g.attributes.map(a => [a.name, a.value.join("；")])));
        const found = data.attributes.skuItems.filter(c => Boolean(c.key1.includes("柔光版")) === Boolean(row.softLight) && (!row.network || compact(c.key3 ?? "") === compact(row.network)));
        configurations = [];
        for (const c of found) {
          const match = c.key2.match(/^(\d+GB)\+(\d+(?:GB|TB))$/); assert.ok(match, "商城版本不是单值成对容量");
          if (configurations.some(x => x.memory === match[1] && x.storage === match[2])) continue;
          const page = await getSourceSnapshot(`https://www.opposhop.cn/cn/web/products/${c.skuId}.html`, options), actual = shopData(page), name = actual.name;
          assert.equal(actual.goodsSpuName, base);assert.equal(String(actual.goodsSkuId),c.skuId);
          assert.ok(compact(name).includes(compact(base)) && name.includes(c.key2) && Boolean(name.includes("柔光版")) === Boolean(row.softLight) && (!row.network || compact(name).includes(compact(row.network))));
          const actualRows=new Map(actual.baseAttributes.flatMap(g=>g.attributes.map(a=>[a.name,a.value.join("；")])));
          for(const key of["处理平台","屏幕尺寸","屏幕分辨率"])assert.equal(actualRows.get(key),rows.get(key),"商城相同容量混入不同核心规格版型");
          configurations.push({ memory:match[1], storage:match[2], evidence:evidence(page, match[1] + " + " + match[2], name), officialSkuId:c.skuId });
        }
        specs = readCore(p, rows, [["chip","处理平台"],["gpu","GPU"],["memoryType","运行内存"],["storageType","机身存储"],["screenSize","屏幕尺寸",number,"inch"],["displayType","屏幕类型"],["resolution","屏幕分辨率"],["refreshRate","屏幕刷新率",refresh,"Hz"],["batteryCapacity","电池容量",battery,"mAh"],["rearCamera","后置摄像头"],["frontCamera","前置摄像头"],["port","数据接口"],["chargingMethod","快速充电"],["sim","SIM卡类型"],["security","指纹识别"],["operatingSystem","操作系统"]]);
        excludedEditionColors=data.attributesColorParams.filter(c=>Boolean(c.color.includes("柔光版"))!==Boolean(row.softLight)).map(c=>({name:c.color,reason:row.softLight?"标准版颜色不沿用至柔光独立版型":"柔光版独立SKU，不并入标准版颜色"}));
        gallery = { image:{url:data.url,alt:data.name}, colors:data.attributesColorParams.filter(c => Boolean(c.color.includes("柔光版")) === Boolean(row.softLight) && found.some(s => s.key1 === c.color)).map(c => ({ name:c.color.replace(/ 柔光版$/, ""),url:c.colorUrl })) };
      }
      assert.ok(configurations.length && specs.chip && specs.screenSize, "官网成对配置或核心实际规格缺失");
      specs.memory = evidence(p, [...new Set(configurations.map(c => c.memory))].join(" / "), row.param ? skuRaw : configurations.map(c => c.evidence.rawText).join("；"));
      specs.storage = evidence(p, [...new Set(configurations.map(c => c.storage))].join(" / "), row.param ? skuRaw : configurations.map(c => c.evidence.rawText).join("；"));
      if (row.shopId) { const raw=configurations.map(c=>c.memory+"+"+c.storage).join("；");specs.memory.rawText=raw;specs.storage.rawText=raw; }
      device = {id:row.id,brand:row.brand,market:"CN",category:"tablet",series:row.family,family:row.family,variant,modelName:row.modelName,generation:base.replace(/^(?:OPPO|vivo|荣耀)\s*/, ""),generationOrder:row.releaseYear,releaseYear:row.releaseYear,...(row.release.precision !== "year" ? {releaseDate:row.release.date}:{}),comparisonGroupId:`${row.brand.toLowerCase()}.tablet.${row.group}.${variant}`,configurations,specs,computed:{}};
      source = {id:row.id,modelName:row.modelName,generation:device.generation,releaseYear:row.releaseYear,sourceStatus:"verified",sourcePageType:"expanded_core_spec_snapshots",officialSpecUrl:p.url,officialSpecEvidence:evidence(p,base,title(p)),marketEvidence:evidence(p,"中国大陆",title(p)),configurationMethod:row.param?"中国官网逐条成对上市价目，标准/柔光单独筛选":"中国官方商城skuItems实际skuId逐页可见标题；单值成对版本、网络、柔光逐条绑定，不交叉推导",configurationEvidence:configurations.map(c=>c.evidence),referenceUrls:[p.url,...configurations.map(c=>c.evidence.sourceUrl)],notes:"仅本批有限平板实际SKU；中国官网区域身份+独立已售证据，上市月份与页面现价不当首售日期/首售价。"};
      if(row.shopId) source.officialSpecSnapshotStatus="official_shop_static_spec_data";
      source.versionVerification={variant,configurationMethod:source.configurationMethod,officialSkuIds:configurations.map(c=>c.officialSkuId).filter(Boolean),...(row.network?{networkType:row.network}:{}),excludedEditionTerms:row.softLight?["标准版"]:["柔光版","超轻版"],note:"网络/柔光依据实际逐SKU字段，不从厂商分类页或外观颜色推断；同容量不同实际版型独立device。"};
    } else {
      const result = await importZolSeries({...row, category:"tablet",expectedName:base,series:row.family,variant,seriesUrl:`https://detail.zol.com.cn/series/702/${row.seriesId}_1.html`,variantFilter:row.softLight?"柔光":undefined,excludeVariants:row.softLight?["蜂窝","LTE"]:["柔光","蜂窝","LTE"],comparisonGroupId:`honor.tablet.${row.group}.${variant}`,releaseFallback:{sourceUrl:row.release.url,releaseDate:row.release.date,pattern:new RegExp(row.release.pattern)}},options);
      ({device,source}=result); p=await getSourceSnapshot(row.officialSpecUrl,options); assert.ok(compact(title(p)).includes(compact(base)));
      source.officialSpecUrl=p.url;source.officialSpecEvidence=evidence(p,base,title(p));source.officialSpecSnapshotStatus="technical_route_labels_only";source.marketEvidence=evidence(p,"中国大陆",title(p));source.referenceUrls.push(p.url);
      if (!row.softLight) gallery=readOfficialColorGallery(p.html,{brand:row.brand,modelName:base},p.url);
    }
    await actualRelease(row,source);
    if(row.softLight) source.variantEvidence=evidence(p,"柔光版", row.param ? configurations[0].evidence.rawText : row.shopId ? title(p) : "柔光");
    gallery ??= {colors:[]};
    const excluded=gallery.colors.filter(c=>(row.excludeColors??[]).some(x=>x.name===c.name));gallery.colors=gallery.colors.filter(c=>!excluded.includes(c));
    excludedEditionColors.push(...excluded.map(c=>({name:c.name,reason:row.excludeColors.find(x=>x.name===c.name).reason})));
    if (row.param && row.softLight) { gallery={colors:[]};source.notes+=" 基型官网图库没有逐柔光版映射，不直接沿用标准版图片。"; }
    const photo=c=>({...c,modelName:device.modelName,sourceUrl:p.url,sourceSnapshotHash:p.sha256,fetchedAt:p.fetchedAt,...license});
    source.productImages={modelName:device.modelName,sourceUrl:p.url,sourceSnapshotHash:p.sha256,fetchedAt:p.fetchedAt,...license,...(gallery.image?{primary:photo(gallery.image)}:{}),colors:gallery.colors.map(c=>c.url?photo(c):c),...(excludedEditionColors.length?{excludedColors:excludedEditionColors}:{}),gaps:[...(!gallery.image?["本版型真实主图未核实"]:[]),...gallery.colors.filter(c=>!c.url).map(c=>c.name+"配色图未核实")]};
    if(row.param&&row.softLight)source.productImages.candidateGallery={sourceUrl:p.url,sourceSnapshotHash:p.sha256,note:"基型官网图库仅候选，缺逐柔光SKU外观映射，不注册标准版图为柔光图",...license};
    source.fieldGaps=required.filter(f=>!device.specs[f]).map(field=>({field,reason:field==="launchPrice"?"未登记本版型首发定价独立原文；官网现价/上市价目只用于SKU，不当首售价":"实际来源无本版型可核验值，不借同系列或海外同名补值"}));
    source.referenceUrls=[...new Set(source.referenceUrls)];devices.push(device);sources.push(source);console.log(row.id+": "+device.configurations.length+"SKU");
  }catch(error){blocked.push({id:row.inventoryId??row.id,deviceId:row.id,brand:row.brand,modelName:row.modelName,category:"tablet",series:row.family,releaseYear:row.releaseYear,status:"blocked",reason:error.message,sourceUrls:[row.officialSpecUrl,row.param?"https://www.vivo.com.cn/vivo/param/"+row.param:row.shopId?`https://www.opposhop.cn/cn/web/products/${row.shopId}.html`:undefined,row.release.url].filter(Boolean)});console.log("BLOCKED "+row.id+": "+error.message);}
}

const inventory=[...new Map(prior.flatMap(db=>db.metadata.audit.inventory).map(r=>[r.id,r])).values()].filter(r=>!processed.has(r.id));
for(const row of fixture.discoveredVariants){const p=await getSourceSnapshot(row.sourceUrl,options),raw=staticText(p).match(new RegExp(row.rawPattern))?.[0];assert.ok(raw,"新候选版型缺实际原文");if(!inventory.some(r=>r.id===row.id))inventory.push({...row,sourceUrls:[p.url],sourceEvidence:evidence(p,row.modelName,raw)});}
for(const r of inventory) if(existing.some(d=>d.id===r.id||compact(d.modelName)===compact(r.modelName)))r.status="present";
for(const d of existing)if(!inventory.some(r=>r.id===d.id))inventory.push({id:d.id,brand:d.brand,modelName:d.modelName,category:d.category,releaseYear:d.releaseYear,series:d.family,status:"present",sourceUrls:existingSources.find(s=>s.id===d.id)?.referenceUrls??[]});
for(const d of devices)inventory.push({id:d.id,brand:d.brand,modelName:d.modelName,category:d.category,releaseYear:d.releaseYear,series:d.family,status:"added",sourceUrls:sources.find(s=>s.id===d.id).referenceUrls});inventory.push(...blocked);
const validation=new Map(["OPPO","vivo","HONOR"].map(b=>[b,{offline:options.offline,specFieldsChecked:0,fieldHashesChecked:0,configurationsChecked:0,imagePageHashesChecked:0,sourcePageType:"expanded_core_spec_snapshots",configurationMethod:"官方实际成对SKU或严格单值逐SKU；标准/柔光/网络版型独立，无首值/交叉相乘",coreFieldGapsComplete:true}]));
for(const d of devices){
  const s=sources.find(s=>s.id===d.id),row=fixture.targets.find(r=>r.id===d.id),check=validation.get(d.brand),urls=new Set(s.referenceUrls);check.specFieldsChecked+=Object.keys(d.specs).length;
  for(const field of [...Object.values(d.specs),...d.configurations.map(c=>c.evidence),...s.configurationEvidence??[],s.officialSpecEvidence,s.marketEvidence,s.releaseEvidence,s.releaseCorroboration,...s.releaseDateConflicts??[],s.variantEvidence].filter(Boolean)){
    assert.ok(urls.has(field.sourceUrl)&&field.rawText?.trim()&&field.fetchedAt&&field.verifiedAt);const p=await getSourceSnapshot(field.sourceUrl,{offline:true});assert.equal(field.sourceSnapshotHash,p.sha256);
    const text=(staticText(p)+" "+[...zolRows(p.html)].map(([k,v])=>k+" "+v).join(" ")).replace(/\s/g,"");for(const raw of field.rawText.split("；"))assert.ok(text.includes(raw.replace(/\s/g,"")),d.id+": 原文不在快照："+raw);check.fieldHashesChecked++;
  }
  assert.equal(new Set(d.configurations.map(c=>c.memory+"|"+c.storage)).size,d.configurations.length);
  for(const c of d.configurations){assert.equal(readSingleCapacity(c.memory),c.memory);assert.equal(readSingleCapacity(c.storage),c.storage);const p=await getSourceSnapshot(c.evidence.sourceUrl,{offline:true});if(row.param||row.shopId){assert.ok(c.evidence.rawText.includes(c.memory+"+"+c.storage));if(row.shopId){const data=shopData(p);assert.equal(String(data.goodsSkuId),c.officialSkuId);assert.ok(data.name.includes(c.memory+"+"+c.storage));}else assert.equal(Boolean(c.evidence.rawText.includes("柔光版")),Boolean(row.softLight));}else{const rows=zolRows(p.html);assert.equal(readSingleCapacity(rows.get("系统内存")??rows.get("RAM容量")),c.memory);assert.equal(readSingleCapacity(rows.get("存储容量")??rows.get("ROM容量")),c.storage);}check.configurationsChecked++;}
  assert.deepEqual(s.fieldGaps.map(g=>g.field).sort(),required.filter(f=>!d.specs[f]).sort());
  for(const img of [s.productImages.primary,...s.productImages.colors.filter(c=>c.url)].filter(Boolean)){assert.equal(img.modelName,d.modelName);assert.equal(img.licenseStatus,"unknown");assert.ok(urls.has(img.sourceUrl));const p=await getSourceSnapshot(img.sourceUrl,{offline:true});assert.equal(img.sourceSnapshotHash,p.sha256);assert.ok(staticText(p).includes(img.url)||p.html.includes(img.url.replace(/&/g,"&amp;")),d.id+": 图片URL不在原页");check.imagePageHashesChecked++;}
}
assert.ok(devices.length>=8,"实际核验不足8款，不交付不完整批次");
for(const [slug,brand]of[["oppo","OPPO"],["vivo","vivo"],["honor","HONOR"]]){
  const selected=devices.filter(d=>d.brand===brand),ids=new Set(selected.map(d=>d.id)),own=inventory.filter(r=>r.brand===brand),previous=prior.find(db=>db.devices[0]?.brand===brand).metadata.audit;
  const audit={replayValidation:validation.get(brand),inventory:own,pending:own.filter(r=>r.status==="pending"),blocked:own.filter(r=>r.status==="blocked"),checkedThisBatchIds:fixture.targets.filter(r=>r.brand===brand).map(r=>r.inventoryId??r.id),inheritedBlockedIds:own.filter(r=>r.status==="blocked"&&!processed.has(r.id)).map(r=>r.id),resolvedInheritedBlockedIds:previous.blocked.filter(r=>selected.some(d=>d.id===r.id)).map(r=>r.id),newBlockedIds:blocked.filter(r=>r.brand===brand).map(r=>r.id),differenceFromExisting:own.filter(r=>r.status!=="present"),scopeChecks:previous.scopeChecks,catalogueEvidence:previous.catalogueEvidence,enumerationScope:{phone:"本批未扩展，partial",tablet:"既有有限候选的实际身份/年份差集；柔光/网络版型另列，仍partial，未枚举范围不表示不存在",laptop:"本批未开展，partial"},statusMeaning:{present:"当前manifest已收录",added:"本批新实际证据通过",pending:"尚未开展关键证据核验",blocked:"本批实际检查失败或继承旧阻塞；inheritedBlockedIds未在本批重试"}};
  const generatedAt = selected.flatMap(d => [...Object.values(d.specs), ...d.configurations.map(c => c.evidence)])
    .map(field => field.fetchedAt.slice(0, 10)).sort().at(-1);
  for (const [name, data] of [[`${slug}-five-year-batch6-devices-db.json`, {metadata:{version:"1.0",generatedAt,totalDevices:selected.length,coverage:{market:"CN",minReleaseYear:2022,asOf:fixture.asOf,scope:fixture.scope,partial:true},audit},devices:selected}], [`${slug}-five-year-batch6-sources.json`, {phone:[],tablet:sources.filter(s=>ids.has(s.id)),laptop:[]}]] ) {
    const path = new URL(`../src/data/${name}`, import.meta.url), output = JSON.stringify(data,null,2)+"\n";
    if (checkOnly) assert.equal(await fs.readFile(path,"utf8"),output,name+": 离线重放与已保存输出不一致");
    else await fs.writeFile(path,output);
  }
}
console.log(`新增${devices.length}款/${devices.reduce((n,d)=>n+d.configurations.length,0)}SKU，本批blocked${blocked.length}`);
