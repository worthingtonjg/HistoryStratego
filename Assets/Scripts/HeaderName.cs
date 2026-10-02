using System;
using System.Globalization;

public static class HeaderName
{
	public static string Fit(string name, float width, Func<string, float> measure)
	{
		name = name ?? "";
		if (measure(name) <= width)
			return name;
		const string ellipsis = "�";
		if (measure(ellipsis) > width)
			return "";
		int[] starts = StringInfo.ParseCombiningCharacters(name);
		for (int i = starts.Length - 1; i > 0; i--)
		{
			int end = starts[i];
			// Keep joined emoji intact as well as surrogate pairs and combining marks.
			if (name[end - 1] == '\u200d' || name[end] == '\u200d')
				continue;
			string candidate = name.Substring(0, end).TrimEnd() + ellipsis;
			if (measure(candidate) <= width)
				return candidate;
		}

		return ellipsis;
	}
}
