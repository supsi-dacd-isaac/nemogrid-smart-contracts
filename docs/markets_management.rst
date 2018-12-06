Creation and storage
======================

The high-level management of the energy markets is ruled by the smart contract :code:`GroupsManager`.

The main aim of the contract is to create and store groups of markets.
Each group is identified by the following two parameters:

- a **DSO** wallet (Distribution System Operator) (:code:`dso`), which is the energy provider
- an ERC20 **token** (named NGT, NemoGrid Token)

Only the owner of :code:`GroupsManager` is allowed to add a new group of markets, performing a transaction related to the function :code:`addGroup`.

Once the group has been created, the :code:`dso` can start playing the energy markets with its users using the contract :code:`MarketsManager`.

