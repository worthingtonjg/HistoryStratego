using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;

public static class TabletopPreview
{
	public static void Render()
	{
		var host = new GameObject("Visual fixture - not a live match");
		var board = host.AddComponent<TabletopBoard>();
		RenderSettings.ambientLight = new Color(.7f, .7f, .7f);
		RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
		var ranks = new List<string>();
		string[] r =
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
		int[] c =
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
		for (int i = 0; i < r.Length; i++)
			for (int n = 0; n < c[i]; n++)
				ranks.Add(r[i]);
		(ranks[0], ranks[34]) = (ranks[34], ranks[0]);
		var pieces = new PieceView[100];
		for (int i = 0; i < 40; i++)
		{
			pieces[60 + i] = new PieceView
			{
				side = 0,
				rank = ranks[i]
			};
			pieces[i] = new PieceView
			{
				side = 1,
				rank = "?"
			};
		}

		var rendered = (RenderTexture)board.Render(pieces, 0, -1, null, -1, -1, 1400, 1050);
		board.Flush();
		RenderTexture.active = rendered;
		var image = new Texture2D(rendered.width, rendered.height, TextureFormat.RGB24, false);
		image.ReadPixels(new Rect(0, 0, rendered.width, rendered.height), 0, 0);
		image.Apply();
		Directory.CreateDirectory("docs/evidence");
		string output = "docs/evidence/tabletop-" + System.DateTime.UtcNow.ToString("yyyyMMdd-HHmmss") + ".png";
		File.WriteAllBytes(output, image.EncodeToPNG());
		RenderTexture.active = null;
		Object.DestroyImmediate(image);
		Object.DestroyImmediate(host);
		Debug.Log("TABLETOP_PREVIEW_SAVED " + output);
	}
}
