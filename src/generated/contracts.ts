import { getAddress, type Address } from 'viem';

export const SUPERNOVA_CONTRACTS = {
  routerv2: getAddress('0xbfae8e87053309fde07ab3ca5f4b5345f8e3058f') as Address,
  swaprouter: getAddress('0x72d63a5b080e1b89cc93f9b9f50cbfa5e291c8ac') as Address,
  pairfactory: getAddress('0x5aef44edfc5a7edd30826c724ea12d7be15bdc30') as Address,
  factorycl: getAddress('0x44b7fbd4d87149efa5347c451e74b9fd18e89c55') as Address,
  gaugemanager: getAddress('0x19a410046afc4203aece5fbfc7a6ac1a4f517ae2') as Address,
  gaugemanagerImpl: getAddress('0x120ea99bdc2da6de1b98fbeb84cfaead96a6a9e3') as Address,
  voter: getAddress('0x1c7bf2532dfa34eeea02c3759e0ca8d87b1d8171') as Address,
  nfpm: getAddress('0x00d5bbd0fe275efee371a2b34d0a4b95b0c8aaaa') as Address,
  farmingcenter: getAddress('0x428ea5b4ac84ab687851e6a2688411bdbd6c91af') as Address,
  quoterv2: getAddress('0x8217550d36823b1194b58562dac55d7fe8efb727') as Address,
  quoter: getAddress('0xf9439cd803dcb11fa574bcc8421207f89b529e41') as Address,
  nova: getAddress('0x00da8466b296e382e5da2bf20962d0cb87200c78') as Address,
  weth: getAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2') as Address,
  usdc: getAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48') as Address,
} as const;

export const SUPERNOVA_ALIASES: Record<string, Address> = {
  ...SUPERNOVA_CONTRACTS,
  eth: getAddress('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') as Address,
};

export const SUPERNOVA_PROXY_NOTES = {
  gaugemanager: {
    proxy: SUPERNOVA_CONTRACTS.gaugemanager,
    implementation: SUPERNOVA_CONTRACTS.gaugemanagerImpl,
    note: 'Read the proxy address with the implementation ABI.',
  },
} as const;
