import type { DeployFunction } from "hardhat-deploy/types";
import { zeroAddress } from "viem";

const deploy: DeployFunction = async ({ midl }) => {
  console.log("Starting deployment process...");

  await midl.initialize();

  await midl.deploy("WETH9", { args: [] });

  await midl.execute();
};

deploy.tags = ["main", "WETH9"];

export default deploy;

