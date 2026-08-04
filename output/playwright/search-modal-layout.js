async (page) => {
  await page.setContent(`
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; }
      .modal-back {
        position: fixed;
        inset: 0;
        display: grid;
        place-items: center;
        padding: 20px;
      }
      .modal {
        width: 560px;
        max-height: calc(100dvh - 40px);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid;
      }
      .modal-search {
        align-self: start;
        margin-top: 12vh;
      }
      .search-h,
      .search-foot {
        flex: 0 0 auto;
        height: 48px;
      }
      .search-body {
        min-height: 0;
        overflow-y: auto;
        flex: 1 1 auto;
      }
      .item { height: 40px; }
    </style>
    <div class="modal-back">
      <div id="dialog" class="modal modal-search">
        <div class="search-h">Search</div>
        <div id="body" class="search-body"></div>
        <div id="foot" class="search-foot">Close</div>
      </div>
    </div>
  `);

  await page.locator("#body").evaluate((element) => {
    element.innerHTML = Array.from(
      { length: 30 },
      (_, index) => `<div class="item">Result ${index}</div>`,
    ).join("");
  });

  return page.evaluate(() => {
    const dialog = document.querySelector("#dialog").getBoundingClientRect();
    const body = document.querySelector("#body");
    const foot = document.querySelector("#foot").getBoundingClientRect();

    return {
      viewportHeight: innerHeight,
      dialogTop: dialog.top,
      dialogBottom: dialog.bottom,
      footBottom: foot.bottom,
      bodyClientHeight: body.clientHeight,
      bodyScrollHeight: body.scrollHeight,
    };
  });
}
