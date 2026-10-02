Shader "History/PieceFace" {
 Properties { _MainTex("Sample artwork",2D)="white"{} }
 SubShader { Tags { "RenderType"="Opaque" } Pass {
 CGPROGRAM
 #pragma vertex vert
 #pragma fragment frag
 #include "UnityCG.cginc"
 sampler2D _MainTex;
 struct appdata { float4 vertex:POSITION; float2 uv:TEXCOORD0; };
 struct v2f { float4 vertex:SV_POSITION; float2 uv:TEXCOORD0; };
 v2f vert(appdata v){v2f o;o.vertex=UnityObjectToClipPos(v.vertex);o.uv=v.uv;return o;}
 fixed4 frag(v2f i):SV_Target {
   float2 uv=float2((1-i.uv.x-.11)/.78,(1-i.uv.y-.015)/.72);
   fixed3 paper=fixed3(.93,.89,.76);
   if(any(uv<0)||any(uv>1))return fixed4(paper,1);
   fixed4 art=tex2D(_MainTex,uv);
   return fixed4(lerp(paper,art.rgb,art.a),1);
 }
 ENDCG
 } }
 Fallback "History/Tabletop"
}
