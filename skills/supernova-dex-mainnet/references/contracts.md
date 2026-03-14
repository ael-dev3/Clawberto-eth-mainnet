# Supernova ETH Mainnet Contracts

Canonical addresses used by the adapter live in `src/generated/contracts.ts`.

## Core contracts

- `routerv2` — `0xbFAe8E87053309fDe07ab3cA5f4B5345f8e3058f`
- `swaprouter` — `0x72D63A5B080e1B89cC93F9B9F50cbfA5e291c8ac`
- `pairfactory` — `0x5aEf44EDFc5A7eDd30826c724eA12D7Be15bDc30`
- `factorycl` — `0x44B7fBd4D87149eFa5347c451E74B9FD18E89c55`
- `gaugemanager` — `0x19a410046Afc4203AEcE5fbFc7A6Ac1a4F517AE2`
- `gaugemanagerImpl` — `0x120ea99bdC2da6dE1b98fBEB84CfaeAd96A6a9e3`
- `voter` — `0x1c7BF2532dfa34eeea02C3759E0ca8D87B1D8171`
- `nfpm` — `0x00d5BbD0Fe275EFEE371a2B34d0a4b95B0C8aaaa`
- `farmingcenter` — `0x428EA5b4ac84aB687851E6A2688411BDbd6C91AF`
- `quoterv2` — `0x8217550d36823b1194b58562dAc55d7FE8EFB727`
- `quoter` — `0xF9439CD803dcB11FA574bCC8421207f89B529E41`

## Token aliases

- `nova` — `0x00Da8466B296E382E5Da2Bf20962D0cB87200c78`
- `weth` — `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`
- `usdc` — `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`

## Live metadata inventory

For the fuller verified/discovered inventory, use:
- `metadata/live_contracts_eth_mainnet.json`
- `metadata/live_contracts_eth_mainnet.csv`

Or via command:

```bash
npm run snova -- "snova contracts --all"
```

## Proxy notes

### GaugeManager

- Read target: proxy `0x19a410046Afc4203AEcE5fbFc7A6Ac1a4F517AE2`
- ABI source: implementation `0x120ea99bdC2da6dE1b98fBEB84CfaeAd96A6a9e3`

Rule: **read the proxy address with the implementation ABI**.
