Shader "History/Tabletop" {
 Properties { _Color("Tint",Color)=(1,1,1,1) _MainTex("Texture",2D)="white"{} _Unlit("Unlit",Float)=0 }
 SubShader { Tags { "RenderType"="Opaque" } Pass {
 CGPROGRAM
 #pragma vertex vert
 #pragma fragment frag
 #include "UnityCG.cginc"
 sampler2D _MainTex; float4 _MainTex_ST; fixed4 _Color; float _Unlit;
 struct appdata { float4 vertex:POSITION; float3 normal:NORMAL; float2 uv:TEXCOORD0; };
 struct v2f { float4 vertex:SV_POSITION; float2 uv:TEXCOORD0; float light:TEXCOORD1; };
 v2f vert(appdata v){ v2f o; o.vertex=UnityObjectToClipPos(v.vertex);o.uv=TRANSFORM_TEX(v.uv,_MainTex);o.light=lerp(.55+.4*saturate(dot(normalize(UnityObjectToWorldNormal(v.normal)),normalize(float3(-.3,.8,-.6)))),1,_Unlit);return o; }
 fixed4 frag(v2f i):SV_Target { fixed4 c=tex2D(_MainTex,i.uv)*_Color;c.rgb*=i.light;return c; }
 ENDCG
 } }
}
