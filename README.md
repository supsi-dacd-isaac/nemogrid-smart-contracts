# nemogrid-smart-contracts

Ther basic idea of the smart contracts is to manage monthly energy markets. The development of blockchain-based energy markets is an aim of Nemogrid project ((http://nemogrid.eu/).

# Description

Each market is defined by:
* a `DSO` (Distribution System Operator),
* a user, called `Player` in the contracts, whose energy is provided by the DSO
* an ERC20 token (named NGT, NemoGrid Token) to stake and distribute revenues or penalties
* a month, the period related to the market
* a set of features (maximum peaks to avoid to reach, revenue/penalty amounts, staked tokens, referee wallet etc.)

`DSO` and `Player` aggree off-chain on the market features and than send sequentially the following on-chain transactions:

<pre>
1) OPENING: DSO opens the market
2) OPENING_CONFIRM: Player confirms the market opening
3) SETTLE: DSO settles the market, sending the maximum consumption of Player to the contract
4) SETTLEMENT_CONFIRM: Player confirms or not the settlement
</pre>

If the settlement is not confirmed by `Player` an additional transaction is requested. This is performed by `Referee`, a third-party wallet, which will have the final decision.

# Acknowledgements
The authors would like to thank the Swiss Federal Office of Energy (SFOE) and the Swiss Competence Center for Energy Research - Future Swiss Electrical Infrastructure (SCCER-FURIES), for their financial and technical support to this research work.

