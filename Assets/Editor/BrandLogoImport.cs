using UnityEditor;

public sealed class BrandLogoImport : AssetPostprocessor
{
	void OnPreprocessTexture()
	{
		if (assetPath != "Assets/Resources/BrandLogo.png")
			return;
		var importer = (TextureImporter)assetImporter;
		importer.textureType = TextureImporterType.Default;
		importer.alphaSource = TextureImporterAlphaSource.FromInput;
		importer.alphaIsTransparency = true;
		importer.mipmapEnabled = false;
		importer.npotScale = TextureImporterNPOTScale.None;
		importer.maxTextureSize = 2048;
		importer.textureCompression = TextureImporterCompression.Uncompressed;
	}
}
