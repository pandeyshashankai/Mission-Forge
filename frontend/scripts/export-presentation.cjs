const fs = require("node:fs");
const path = require("node:path");
const { browserSession } = require("./browser-session.cjs");
(async () => {
  const b = await browserSession();
  try {
    await b.call("Page.navigate", {
      url: "http://127.0.0.1:8080/submission/presentation.html",
    });
    await b.wait('document.querySelectorAll(".slide").length===7');
    await b.viewport(1280, 720);
    const result = await b.call("Page.printToPDF", {
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    });
    const output = path.resolve(
      __dirname,
      "../public/submission/presentation.pdf",
    );
    fs.writeFileSync(output, Buffer.from(result.data, "base64"));
    console.log("Exported seven-slide presentation PDF");
  } finally {
    b.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
