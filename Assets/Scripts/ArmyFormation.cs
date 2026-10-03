using System;
using System.Collections.Generic;

// Keep this seeded algorithm identical to web/formation.mjs; cross-language
// vectors test it. Indices 0..9 face the opponent; 30..39 are the owner's back row.
public static class ArmyFormation
{
	sealed class Generator
	{
		uint state;
		public Generator(uint seed)
		{
			state = seed == 0 ? 0x6d2b79f5u : seed;
		}

		public int Next(int n)
		{
			state ^= state << 13;
			state ^= state >> 17;
			state ^= state << 5;
			return (int)((double)state / 4294967296.0 * n);
		}

		public void Shuffle<T>(IList<T> a)
		{
			for (int i = a.Count - 1; i > 0; i--)
			{
				int j = Next(i + 1);
				T v = a[i];
				a[i] = a[j];
				a[j] = v;
			}
		}
	}

	public static string[] Generate()
	{
		return Generate(BitConverter.ToUInt32(Guid.NewGuid().ToByteArray(), 0));
	}

	public static string[] Generate(uint seed)
	{
		var rng = new Generator(seed);
		string[] cells = new string[40];
		string[] ranks =
		{
			"F",
			"B",
			"1",
			"2",
			"3",
			"4",
			"5",
			"6",
			"7",
			"8",
			"9",
			"10"
		};
		int[] counts =
		{
			1,
			6,
			1,
			8,
			5,
			4,
			4,
			4,
			3,
			2,
			1,
			1
		};
		int column = rng.Next(10), flag = 30 + column;
		cells[flag] = "F";
		cells[flag - 10] = "B";
		if (column > 0)
			cells[flag - 1] = "B";
		if (column < 9)
			cells[flag + 1] = "B";
		int[] front =
		{
			0,
			1,
			2,
			3,
			4,
			5,
			6,
			7,
			8,
			9
		};
		rng.Shuffle(front);
		for (int i = 0; i < 8; i++)
			cells[front[i]] = "2";
		var back = new List<int>();
		for (int i = 30; i < 40; i++) if (cells[i] == null) back.Add(i);
		rng.Shuffle(back);
		for (int i = 0; i < Math.Min(5, back.Count); i++) cells[back[i]] = "3";
		var bag = new List<string>();
		for (int i = 0; i < ranks.Length; i++)
		{
			int placed = 0;
			foreach (var rank in cells)
				if (rank == ranks[i])
					placed++;
			for (int n = placed; n < counts[i]; n++)
				bag.Add(ranks[i]);
		}

		rng.Shuffle(bag);
		int cursor = 0;
		for (int i = 0; i < 40; i++)
			if (cells[i] == null)
				cells[i] = bag[cursor++];
		return cells;
	}
}
