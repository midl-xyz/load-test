import type {DeployFunction} from "hardhat-deploy/types";

const deploy: DeployFunction = async ({midl}) => {
    console.log("Starting deployment process...");

    await midl.initialize();

    const UniswapV2Factory = await midl.getDeployment("UniswapV2Factory");
    const WETH = await midl.getDeployment("WETH9");

    await midl.deploy("UniswapV2Router02", {
        args: [UniswapV2Factory?.address, WETH?.address],
    });

    await midl.execute();
};

deploy.tags = ["main", "UniswapV2Router02"];

export default deploy;
