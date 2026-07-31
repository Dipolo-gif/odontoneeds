# Gravação do tratamento de cor nos arquivos de imagem.
# Rodar de novo sempre que uma foto de origem for trocada:
#   powershell -File tools\grade.ps1
#
# Motivo de existir: aplicar filtro de cor via CSS sobre imagem grande
# obriga o navegador a repintar a cada frame de hover. Gravando no arquivo,
# o custo é zero em runtime.

Add-Type -AssemblyName System.Drawing
$p = Join-Path $PSScriptRoot "..\public"

function Grade {
  param($in,$out,$x,$y,$w,$h,$maxW,$bright,$desat,$cool)

  $img = [System.Drawing.Image]::FromFile((Resolve-Path $in))
  if ($w -le 0) { $x = 0; $y = 0; $w = $img.Width; $h = $img.Height }

  $ow = $w; $oh = $h
  if ($ow -gt $maxW) { $oh = [int]($oh * $maxW / $ow); $ow = $maxW }

  $bmp = New-Object System.Drawing.Bitmap($ow,$oh,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.DrawImage($img,
    (New-Object System.Drawing.Rectangle(0,0,$ow,$oh)),
    (New-Object System.Drawing.Rectangle($x,$y,$w,$h)), 'Pixel')
  $g.Dispose(); $img.Dispose()

  $rect = New-Object System.Drawing.Rectangle(0,0,$ow,$oh)
  $d = $bmp.LockBits($rect,'ReadWrite','Format32bppArgb')
  $len = $ow*$oh*4
  $buf = New-Object byte[] $len
  [System.Runtime.InteropServices.Marshal]::Copy($d.Scan0,$buf,0,$len)

  for ($i=0; $i -lt $len; $i+=4) {
    $b=[double]$buf[$i]; $gr=[double]$buf[$i+1]; $r=[double]$buf[$i+2]
    $lum = 0.299*$r + 0.587*$gr + 0.114*$b
    $r = ($r + ($lum-$r)*$desat) * $bright * (1 - $cool*0.02)
    $gr= ($gr + ($lum-$gr)*$desat) * $bright
    $b = ($b + ($lum-$b)*$desat) * $bright * (1 + $cool*0.04)
    $buf[$i]  =[byte][Math]::Max(0,[Math]::Min(255,[Math]::Round($b)))
    $buf[$i+1]=[byte][Math]::Max(0,[Math]::Min(255,[Math]::Round($gr)))
    $buf[$i+2]=[byte][Math]::Max(0,[Math]::Min(255,[Math]::Round($r)))
  }

  [System.Runtime.InteropServices.Marshal]::Copy($buf,0,$d.Scan0,$len)
  $bmp.UnlockBits($d)

  $enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $prm = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $prm.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality,84)
  $bmp.Save($out,$enc,$prm); $bmp.Dispose()
  "{0} -> {1}x{2} ({3} KB)" -f (Split-Path $out -Leaf), $ow, $oh, [Math]::Round((Get-Item $out).Length/1kb,1)
}

# origem                        destino                  x   y    w    h   maxW bright desat cool
Grade "$p\src-consultorio.jpg" "$p\art-clinica.jpg"      0   0    0    0    900  1.06  0.18  1
Grade "$p\src-consultorio.jpg" "$p\art-ortodontia.jpg" 330  40  349  330   700  1.08  0.24  1
Grade "$p\src-maos.jpg"        "$p\art-equipe.jpg"       0   0    0    0    800  1.05  0.20  1

# fundo do hero: foto real do consultório. Dessaturação alta e brilho acima
# do normal porque ela fica atrás de texto e precisa recuar para o fundo.
Grade "$p\src-equipe-consultorio.png" "$p\hero-equipe.jpg" 0 0 0 0 1400 1.12 0.30 1
