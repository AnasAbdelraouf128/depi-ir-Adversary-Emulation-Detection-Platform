exports.header = {
  height: "1.5cm",
  contents: function() {
    return "<div style='width: 100%; border-top: 10px solid #10725a; border-bottom: 4px solid #2ab68b; height: 100%; box-sizing: border-box;'></div>";
  }
};

exports.footer = {
  height: "1.5cm",
  contents: function(pageNum, numPages) {
    return "<div style='width: 100%; border-bottom: 10px solid #10725a; height: 100%; box-sizing: border-box;'></div>";
  }
};
