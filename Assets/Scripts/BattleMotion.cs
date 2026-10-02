using System;

// Presentation roles never depend on winner or chosen spectator perspective.
public static class BattleMotion
{
	public struct Pose
	{
		public float attackerX, defenderX, attackerFall, defenderFall;
	}

	static float Clamp(float v)
	{
		return Math.Max(0, Math.Min(1, v));
	}

	public static Pose At(string attacker, int outcome, float progress)
	{
		float approach = (float)Math.Sin(Clamp(progress / .5f) * Math.PI / 2) * 1.05f;
		float t = Clamp((progress - .52f) / .45f), fall = t * t * (3 - 2 * t) * 88;
		return new Pose
		{
			attackerX = -.85f + (attacker == "B" || attacker == "F" ? 0 : approach),
			defenderX = .85f,
			attackerFall = outcome <= 0 ? fall : 0,
			defenderFall = outcome >= 0 ? -fall : 0
		};
	}
}
