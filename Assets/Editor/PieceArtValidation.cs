using System;
using System.IO;
using UnityEditor;
using UnityEngine;

public static class PieceArtValidation
{
	public static void Validate()
	{
		foreach (var rank in new[]
		{
			"10",
			"9",
			"8",
			"7",
			"6",
			"5",
			"4",
			"3",
			"2",
			"1",
			"B",
			"F"
		}

		)
		{
			var path = "Assets/Resources/" + PieceArtResources.Key(rank) + ".png";
			var importer = (TextureImporter)AssetImporter.GetAtPath(path);
			if (importer.alphaSource != TextureImporterAlphaSource.FromInput || !importer.alphaIsTransparency || importer.GetPlatformTextureSettings("WebGL").format != TextureImporterFormat.RGBA32)
				throw new Exception("Alpha import mismatch: " + rank);
			var decoded = new Texture2D(2, 2, TextureFormat.RGBA32, false);
			if (!ImageConversion.LoadImage(decoded, File.ReadAllBytes(path)))
				throw new Exception("PNG decode failed");
			int min = 255, max = 0;
			foreach (var pixel in decoded.GetPixels32())
			{
				min = Math.Min(min, pixel.a);
				max = Math.Max(max, pixel.a);
			}

			UnityEngine.Object.DestroyImmediate(decoded);
			if (min != 0 || max != 255)
				throw new Exception("Missing real alpha: " + rank);
			Debug.Log("PIECE_ART_VALIDATED " + rank + " input-alpha RGBA32");
		}
	}
}
