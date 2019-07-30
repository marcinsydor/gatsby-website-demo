// const SiteClient = require("gatsby-website-demo").SiteClient;

import { SiteClient } from "datocms-client";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from "fs";
import { basename, join } from "path";
import request from "request";

const args = process.argv.slice(2);
const sourceToken = args[0];
const targetToken = args[1];

console.log("sourceToken:", sourceToken, ", targetToken:", targetToken);

const sourceClient = new SiteClient(sourceToken);
const targetClient = new SiteClient(targetToken);

let sourceSite;
let targetSite;

let rootBackupDir = "backup";
let backupDir = join(rootBackupDir, new Date().toJSON().toString());
let imagesDir = join(backupDir, "images");

const itemTypesMap = new Map();
const fieldsMap = new Map();

async function init() {
  sourceSite = await sourceClient.site.find();
  // console.log("source site name:", sourceSite.name);

  targetSite = await targetClient.site.find();
  // console.log("target site name:", targetSite.name);

  // const ok = await yesno({
  //   question: `Restoring data from "${sourceSite.name}" to "${targetSite.name}" \nAre you sure you want to do it [yes, no]?`
  // });

  // if (!ok) return;

  await createDirs();
  await getSourceItemTypesAndFields();
  await getSourceItems();
  // await uploadImages();

  if (targetClient) {
    await destroyTargetItemTypesAndFields();
    await createTargetItemTypesAndFields();
    // await createTargetRecords();
  }

  console.log("done");
}

async function createDirs() {
  if (!existsSync(rootBackupDir)) {
    mkdirSync(rootBackupDir);
  }

  if (!existsSync(backupDir)) {
    mkdirSync(backupDir);
  }

  if (!existsSync(imagesDir)) {
    mkdirSync(imagesDir);
  }
}

async function getSourceItemTypesAndFields() {
  console.log("getSourceItemTypesAndFields - start");
  const itemTypes = await sourceClient.itemTypes.all({});
  writeFileSync(
    join(backupDir, "item-types.json"),
    JSON.stringify(itemTypes, null, 2)
  );
  await Promise.all(
    itemTypes.map(async itemType => {
      await getSourceFields(itemType.id);
    })
  );
  console.log("getSourceItemTypesAndFields - complete");
}

async function getSourceFields(itemTypeId) {
  const fields = await sourceClient.fields.all(itemTypeId);
  writeFileSync(
    join(backupDir, `item-types-${itemTypeId}-fields.json`),
    JSON.stringify(fields, null, 2)
  );
}

async function createTargetRecords() {
  const records = JSON.parse(readFileSync(join(backupDir, "records.json")));

  await Promise.all(
    records.all(async record => {
      const { id, ...r } = records;
      console.log("id", id);
      await targetClient.items.create(r);
    })
  );
}

async function destroyTargetItemTypesAndFields() {
  try {
    console.log(`destroyTargetItemTypesAndFields - start`);
    const itemTypes = await targetClient.itemTypes.all();
    await Promise.all(
      itemTypes.map(async type => {
        console.log(`destroyTargetItemTypesAndFields - destroy: ${type.id}`);
        await targetClient.itemTypes.destroy(type.id);
        await destroyTargetFields(type.id);
        console.log(
          `destroyTargetItemTypesAndFields - destroy complete: ${type.id}`
        );
      })
    );
    console.log(`================= destroyTargetItemTypesAndFields - complete`);
  } catch (e) {
    console.log(`destroyTargetItemTypesAndFields - error: ${e}`);
  }
}

async function destroyTargetFields(itemTypeId) {
  try {
    console.log(`destroyTargetFields - start`);
    const fields = await targetClient.fields.all(itemTypeId);
    console.log(`destroyTargetFields - start, fields: ${fields}`);
    await Promise.all(
      fields.map(async type => await targetClient.fields.destroy(type.id))
    );
    console.log(`destroyTargetFields - complete`);
  } catch (e) {
    console.log(`destroyTargetFields - error: ${e}`);
  }
}

async function createTargetItemTypesAndFields() {
  console.log(`createTargetItemTypesAndFields - start`);
  const itemTypes = JSON.parse(
    readFileSync(join(backupDir, "item-types.json"))
  );

  await Promise.all(
    itemTypes.map(async type => {
      const { id, ...withoutId } = type;
      console.log(type.name, id);
      try {
        const newTypeItem = await targetClient.itemTypes.create(withoutId);
        itemTypesMap.set(id, newTypeItem.id);
        console.log(
          `create itemType: ${newTypeItem.name}, ${id} > ${newTypeItem.id}`
        );
      } catch (e) {
        console.log("error", withoutId.name, e);
      }
    })
  );

  await Promise.all(
    Array.from(itemTypesMap).map(async (key, value) => {
      // TODO find better way to do map Map
      await createTargetFields(key[0], key[1]);
    })
  );

  console.log(`createTargetItemTypesAndFields - complete`);
}

async function createTargetFields(oldItemTypeId, newItemTypeId) {
  console.log(`createTargetFields - start, ${oldItemTypeId}, ${newItemTypeId}`);
  const fields = JSON.parse(
    readFileSync(join(backupDir, `item-types-${oldItemTypeId}-fields.json`))
  );

  await Promise.all(
    fields.map(async field => {
      const { id, ...fieldWithoutId } = field;
      try {
        const newField = await targetClient.fields.create(
          newItemTypeId,
          fieldWithoutId
        );
        fieldsMap.set(id, newField.id);
      } catch (e) {
        console.log(`create filed error: ${e}`);
      }
    })
  );
}

async function getSourceItems() {
  const items = await sourceClient.items.all({}, { allPages: true });
  writeFileSync(
    join(backupDir, "records.json"),
    JSON.stringify(items, null, 2)
  );
}

async function uploadImages() {
  const uploads = await sourceClient.uploads.all({}, { allPages: true });

  await uploads.reduce((chain, upload) => {
    return chain.then(() => {
      return new Promise(resolve => {
        const imageUrl = "https://" + sourceSite.imgixHost + upload.path;
        console.log(`downloading: ${imageUrl}...`);

        const stream = createWriteStream(
          join(imagesDir, basename(upload.path))
        );
        stream.on("close", resolve);
        request(imageUrl).pipe(stream);
      });
    });
  }, Promise.resolve());
}

init();
