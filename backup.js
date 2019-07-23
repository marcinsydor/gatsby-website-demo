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

async function init() {
  sourceSite = await sourceClient.site.find();
  console.log("source site name:", sourceSite.name);

  targetSite = await targetClient.site.find();
  console.log("target site name:", targetSite.name);

  await createDirs();
  await getSourceItemTypesAndFields();
  await getSourceItems();
  // await uploadImages();

  if (targetClient) {
    await destroyTargetItemTypesAndFields();
    // await createTargetItemTypesAndFields();
    await createTargetRecords();
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
  const itemTypes = await sourceClient.itemTypes.all({});
  writeFileSync(
    join(backupDir, "item-types.json"),
    JSON.stringify(itemTypes, null, 2)
  );

  console.log("read all fileds");
  await Promise.all(
    itemTypes.map(async itemType => {
      await getSourceFields(itemType.id);
    })
  );
  console.log("done! -read all fileds");
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
  // Remove all current item types
  const currentAllItemTypes = await targetClient.itemTypes.all();
  await Promise.all(
    currentAllItemTypes.map(
      async type => await targetClient.itemTypes.destroy(type.id)
    )
  );

  // Remove all current item types fields
  const currentAllItemTypesFields = await targetClient.fields.all();
  await Promise.all(
    currentAllItemTypesFields.map(
      async type => await targetClient.fields.destroy(type.id)
    )
  );
}

async function createTargetItemTypesAndFields() {
  const types = JSON.parse(readFileSync(join(backupDir, "item-types.json")));

  await Promise.all(
    types.map(async type => {
      const { id, ...withoutId } = type;
      console.log(type.name, id);
      try {
        const newType = await targetClient.itemTypes.create(withoutId);
        console.log("done", newType.name, newType.id);
      } catch (e) {
        console.log("error", withoutId.name);
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
