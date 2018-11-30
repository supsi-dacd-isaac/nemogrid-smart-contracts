.. Nemogrid smart contracts documentation master file, created by
   sphinx-quickstart on Thu Nov 29 14:55:55 2018.
   You can adapt this file completely to your liking, but it should at least
   contain the root `toctree` directive.

Nemogrid smart contracts's documentation
========================================

Each market is defined by:
- a :code:`DSO` (Distribution System Operator),
- a user, called :code:`Player` in the contracts, whose energy is provided by the DSO
- an ERC20 token (named NGT, NemoGrid Token), which represents the currency used to stake and distribute revenues or penalties
- a month, the period related to the market
- a set of features (maximum peaks to avoid to reach, revenue/penalty amounts, staked tokens, referee wallet etc.)

:code:`DSO` and :code:`Player` agree off-chain on the market features and then send sequentially the following on-chain transactions:

.. code::

   1) OPENING: DSO opens the market
   2) OPENING_CONFIRM: Player confirms the market opening
   3) SETTLE: DSO settles the market, sending the maximum consumption of Player to the contract
   4) SETTLEMENT_CONFIRM: Player confirms or not the settlement

If the settlement is not confirmed by :code:`Player` an additional transaction is requested. This is performed by :code:`Referee`, a third-party wallet, which will have the final decision.


Smart contracts
==================


.. toctree::
    :maxdepth: 4

    groups_manager


Indices and tables
==================

* :ref:`genindex`
* :ref:`search`
