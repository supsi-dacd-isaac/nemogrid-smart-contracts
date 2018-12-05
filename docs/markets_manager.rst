MarketsManager
'''''''''''''''''''''''

.. toctree::
   :maxdepth: 2
   :caption: Contents:

.. autosolcontract:: MarketsManager
    :noindex:
    :members: dso, NGT, marketsData, Opened, ConfirmedOpening, RefundedDSO, Settled, ConfirmedSettlement, RefereeRequested, SuccessfulSettlement, UnsuccessfulSettlement, Prize, Revenue, Penalty, Crash, Closed, RefereeIntervention, PlayerCheated, DSOCheated, DSOAndPlayerCheated, BurntTokens, ClosedAfterJudgement, constructor, open, confirmOpening, refund, settle, confirmSettlement, _decideMarket, _saveAndTransfer, performRefereeDecision, _checkRevenueFactor, _checkStartTime, _calcEndTime, calcIdx, getState, getResult, getPlayer, getReferee, getStartTime, getEndTime, getLowerMaximum, getUpperMaximum, getRevenueFactor, getPenaltyFactor, getDsoStake, getPlayerStake, getFlag