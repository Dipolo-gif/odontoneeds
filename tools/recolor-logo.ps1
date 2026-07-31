# Reveste a marca (ouro sobre preto) na paleta azul do site.
# O recorte por alfa já existe; aqui só a cor é remapeada.
# A luminância do ouro vira posição numa rampa azul, então o relevo
# metálico do logotipo original é preservado.

Add-Type -AssemblyName System.Drawing
$p = Join-Path $PSScriptRoot "..\public"

# rampa: sombra -> meio-tom -> brilho
$C0 = @(6,   47,  82)   # #062F52  sombra
$C1 = @(19, 108, 172)   # #136CAC  meio-tom
$C2 = @(108, 182, 226)  # #6CB6E2  brilho

function Ramp($t){
  if ($t -lt 0.55) { $k = $t/0.55;      $a=$C0; $b=$C1 }
  else             { $k = ($t-0.55)/0.45; $a=$C1; $b=$C2 }
  @(
    [int]($a[0] + ($b[0]-$a[0])*$k),
    [int]($a[1] + ($b[1]-$a[1])*$k),
    [int]($a[2] + ($b[2]-$a[2])*$k)
  )
}

function Recolor($in,$out){
  $src = New-Object System.Drawing.Bitmap($in)
  $w=$src.Width; $h=$src.Height
  $rect = New-Object System.Drawing.Rectangle(0,0,$w,$h)
  $d = $src.LockBits($rect,'ReadWrite','Format32bppArgb')
  $len=$w*$h*4; $buf=New-Object byte[] $len
  [System.Runtime.InteropServices.Marshal]::Copy($d.Scan0,$buf,0,$len)

  # tabela de 256 entradas: evita recalcular a rampa por pixel
  $tbl = New-Object 'int[,]' 256,3
  for($v=0; $v -lt 256; $v++){ $c = Ramp ($v/255.0); $tbl[$v,0]=$c[0]; $tbl[$v,1]=$c[1]; $tbl[$v,2]=$c[2] }

  for($i=0; $i -lt $len; $i+=4){
    if($buf[$i+3] -eq 0){ continue }
    $b=[int]$buf[$i]; $g=[int]$buf[$i+1]; $r=[int]$buf[$i+2]
    $lum=[int](0.299*$r + 0.587*$g + 0.114*$b)
    if($lum -gt 255){$lum=255}
    $buf[$i]  =[byte]$tbl[$lum,2]
    $buf[$i+1]=[byte]$tbl[$lum,1]
    $buf[$i+2]=[byte]$tbl[$lum,0]
  }

  [System.Runtime.InteropServices.Marshal]::Copy($buf,0,$d.Scan0,$len)
  $src.UnlockBits($d)
  $src.Save($out,[System.Drawing.Imaging.ImageFormat]::Png)
  $src.Dispose()
  "{0} -> {1}x{2}" -f (Split-Path $out -Leaf), $w, $h
}

Recolor "$p\marca-alpha.png"  "$p\marca-azul.png"
Recolor "$p\lockup-alpha.png" "$p\lockup-azul.png"
