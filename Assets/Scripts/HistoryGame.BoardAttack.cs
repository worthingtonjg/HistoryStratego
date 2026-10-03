using UnityEngine;
public partial class HistoryGame
{
    Dispatch heldBoardAttack;
    string heldBoardMatch;
    int settlingCell = -1, settlingSeq;
    float settlingStarted;
    Dispatch PrepareBoardAttack(MatchView m, PieceView[] board)
    {
        if (heldBoardMatch != m.id) { heldBoardAttack = null; settlingCell = -1; heldBoardMatch = m.id; }
        // Only confirmed combat data can reconstruct the two combatants.
        var battle = m.battle?.kind == "combat" ? m.battle : null;
        if (battle != null) { if (heldBoardAttack?.seq != battle.seq && Application.absoluteURL.Contains("qa=1")) Debug.Log("BOARD_ATTACK_HELD " + battle.seq); heldBoardAttack = battle; settlingCell = -1; }
        else if (heldBoardAttack != null) {
            var previous = heldBoardAttack; heldBoardAttack = null;
            if (previous.outcome > 0 && board[previous.to]?.side == previous.side) { settlingCell = previous.to; settlingSeq = m.seq; settlingStarted = Time.unscaledTime; if (Application.absoluteURL.Contains("qa=1")) Debug.Log("BOARD_ATTACK_SETTLING"); }
            tabletop?.InvalidatePositions();
        }
        if (battle != null && motion == null) {
            board[battle.from] = new PieceView { side=battle.side, rank=battle.attacker };
            board[battle.to] = new PieceView { side=1-battle.side, rank=battle.defender };
            return battle;
        }
        return null;
    }
    void AnimateBoardAttack(MatchView m, Dispatch battle, int rotate)
    {
        if (battle != null) tabletop.AnimateMove(battle.from, battle.to, rotate, 1, .4f);
        if (settlingCell < 0) return;
        float progress = Mathf.Clamp01((Time.unscaledTime-settlingStarted)/.35f);
        if (m.seq != settlingSeq || progress >= 1 || m.board[settlingCell] == null) { settlingCell=-1; tabletop.InvalidatePositions(); if (Application.absoluteURL.Contains("qa=1")) Debug.Log("BOARD_ATTACK_SETTLED"); return; }
        tabletop.AnimateMove(settlingCell, settlingCell, rotate, 1, .4f*(1-Mathf.SmoothStep(0,1,progress)));
        boostUntil=Time.unscaledTime+.2f;
    }
}
