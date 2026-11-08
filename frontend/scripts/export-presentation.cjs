const fs = require("node:fs");
const path = require("node:path");
const { browserSession } = require("./browser-session.cjs");
(async () => {
  const url = process.env.MF_PRIVATE_PRESENTATION_URL;
  const output = process.env.MF_PRIVATE_PRESENTATION_PDF;
  const repository = path.resolve(__dirname, '../..');
  if (!url || !output || path.resolve(output).startsWith(repository + path.sep)) {
    throw new Error('Set a private presentation URL and an output file outside the repository.');
  }
  const b = await browserSession();
  try {
    await b.call("Page.navigate", {
      url,
    });
    await b.wait('document.querySelectorAll(".slide").length===7');
    await b.viewport(1280, 720);
    const result = await b.call("Page.printToPDF", {
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    });
    fs.writeFileSync(output, Buffer.from(result.data, "base64"));
    console.log("Exported seven-slide presentation PDF");
  } finally {
    b.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
