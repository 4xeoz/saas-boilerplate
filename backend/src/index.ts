import { createApp } from "./app";
import { appConfig } from "./config/config";

const app = createApp();

app.listen(appConfig.port, () => {
  console.log(`Backend listening on http://localhost:${appConfig.port}`);
});
