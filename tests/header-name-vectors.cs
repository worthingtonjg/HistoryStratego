using System;
using System.Globalization;
class HeaderNameVectors
{
    static float Width(string s) { float n = 0; foreach (char c in s) n += c == 'W' ? 12 : c == 'i' ? 3 : 7; return n; }
    static int check; static void Check(bool ok) { check++; if (!ok) throw new Exception("Header name check failed: " + check); }
    static void Main()
    {
        Check(HeaderName.Fit("Webb", 100, Width) == "Webb");
        Check(HeaderName.Fit("Alexander Stewart Webb", 1000, Width) == "Alexander Stewart Webb");
        Check(HeaderName.Fit("William Tecumseh Sherman", 100, Width).EndsWith("�"));
        Check(Width(HeaderName.Fit("William Tecumseh Sherman", 100, Width)) <= 100);
        Check(HeaderName.Fit("iiiiiiii", 30, Width) == "iiiiiiii");
        Check(HeaderName.Fit("WWWWWWWW", 30, Width) == "W�");
        Check(HeaderName.Fit("A\u0301BC", 2, s => StringInfo.ParseCombiningCharacters(s).Length) == "A\u0301�");
        Check(HeaderName.Fit("\U0001F600BC", 2, s => StringInfo.ParseCombiningCharacters(s).Length) == "\U0001F600�");
        Check(HeaderName.Fit("\U0001F469\u200d\U0001F4BBXYZ", 3, s => StringInfo.ParseCombiningCharacters(s).Length) == "�");
        Check(HeaderName.Fit("Long", 1, Width) == "");
        Check(HeaderName.Fit("", 0, Width) == "");
        Console.WriteLine("PASS: measured short/full/long names, variable glyph widths, Unicode boundaries, tiny slots");
    }
}
