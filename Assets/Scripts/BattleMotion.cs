using System;

// Presentation roles never depend on winner or chosen spectator perspective.
public static class BattleMotion
{
	// Upright combat bases are the widest visible part. Keep a small contact gap.
	public const float BaseWidth = .76f;
	public const float ContactGap = .01f;
	const float StartOffset = .85f;
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
		float approach = (float)Math.Sin(Clamp(progress / .5f) * Math.PI / 2) * (2 * StartOffset - BaseWidth - ContactGap);
		float t = Clamp((progress - .52f) / .45f), fall = t * t * (3 - 2 * t) * 88;
		return new Pose
		{
			attackerX = -StartOffset + (attacker == "B" || attacker == "F" ? 0 : approach),
			defenderX = StartOffset,
			attackerFall = outcome <= 0 ? fall : 0,
			defenderFall = outcome >= 0 ? -fall : 0
		};
	}
}
