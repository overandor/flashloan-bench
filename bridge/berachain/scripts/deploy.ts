import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying NativeBridgeLocker with account:', deployer.address);

  const initialValidators = process.env.VALIDATORS?.split(',') || [];
  const validatorThreshold = parseInt(process.env.VALIDATOR_THRESHOLD || '1');

  if (initialValidators.length === 0) {
    throw new Error('VALIDATORS env var required');
  }
  if (validatorThreshold < 1 || validatorThreshold > initialValidators.length) {
    throw new Error('VALIDATOR_THRESHOLD must be between 1 and number of validators');
  }

  const BridgeLocker = await ethers.getContractFactory('NativeBridgeLocker');
  const bridge = await BridgeLocker.deploy(initialValidators, validatorThreshold);

  await bridge.waitForDeployment();
  const address = await bridge.getAddress();

  console.log('NativeBridgeLocker deployed to:', address);
  console.log('Initial validators:', initialValidators);
  console.log('Validator threshold:', validatorThreshold);

  // Verify deployment
  const owner = await bridge.owner();
  const threshold = await bridge.validatorThreshold();
  console.log('Owner:', owner);
  console.log('Threshold:', threshold.toString());

  for (const validator of initialValidators) {
    const isActive = await bridge.validators(validator);
    console.log(`Validator ${validator} active:`, isActive);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
