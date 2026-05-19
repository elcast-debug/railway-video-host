const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

app.use("/videos", express.static(path.join(__dirname, "public/videos"), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".mp4")) {
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
  }
}));

app.get("/", (req, res) => {
  res.send("Video host is running.");
});

app.listen(port, () => {
  console.log(`Server listening on ${port}`);
});