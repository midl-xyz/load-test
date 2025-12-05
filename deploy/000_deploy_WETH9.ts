import { configure, getConsoleSink } from "@logtape/logtape";
import type { DeployFunction } from "hardhat-deploy/types";

const deploy: DeployFunction = async ({ midl }) => {
  await configure({
    sinks: { console: getConsoleSink() },
    loggers: [
      { category: ["logtape", "meta"], sinks: [] },
      { category: [], sinks: ["console"], lowestLevel: "trace" },]
  });

  console.log("Starting deployment process...");

  await midl.initialize();

  await midl.deploy("WETH9", { args: [] });

  await midl.execute();
};

deploy.tags = ["main", "WETH9"];

export default deploy;

