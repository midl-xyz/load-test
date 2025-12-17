import type { DeployFunction } from "hardhat-deploy/types";

const deploy: DeployFunction = async ({ midl }) => {
  console.log("Starting deployment process...");

  await midl.initialize();

  const UniswapV2Factory = await midl.getDeployment("UniswapV2Factory");

  await midl.deploy("UV2Library", { args: [UniswapV2Factory?.address] });

  await midl.execute();
};

deploy.tags = ["main", "UniswapV2Router"];

export default deploy;
