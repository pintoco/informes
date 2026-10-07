#!/usr/bin/env bash
# ============================================================
# Crea en AWS los recursos de almacenamiento para Elemental Pro:
#   - 2 buckets S3 privados (fotos y PDFs): bloqueo de acceso público,
#     cifrado, versionado y CORS para que el navegador suba fotos directo.
#   - 1 usuario IAM con permisos SOLO sobre esos dos buckets + su access key.
#
# Ejecutar UNA vez, desde un equipo con AWS CLI autenticado como administrador
# (o desde AWS CloudShell en la consola web):
#
#   DOMAIN=informes.elementalpro.cl BUCKET_PREFIX=elementalpro-informes \
#     AWS_REGION=us-east-1 bash create-aws-resources.sh
#
# Al final imprime las líneas para pegar en deploy/lightsail/.env
# ============================================================
set -euo pipefail

: "${DOMAIN:?Definir DOMAIN (ej. informes.elementalpro.cl)}"
: "${BUCKET_PREFIX:?Definir BUCKET_PREFIX (nombre único global, ej. elementalpro-informes)}"
REGION="${AWS_REGION:-us-east-1}"
PHOTOS="${BUCKET_PREFIX}-photos"
PDFS="${BUCKET_PREFIX}-pdfs"
IAM_USER="${IAM_USER:-elemental-pro-app}"

echo "Cuenta AWS: $(aws sts get-caller-identity --query Account --output text) · Región: $REGION"

for BUCKET in "$PHOTOS" "$PDFS"; do
  echo "==> Bucket $BUCKET"
  if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
    echo "    ya existe"
  elif [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" >/dev/null
  else
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
  fi

  aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

  aws s3api put-bucket-encryption --bucket "$BUCKET" --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

  # Versionado: protege contra borrados accidentales. Las versiones antiguas se
  # eliminan a los 30 días para no acumular costo.
  aws s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled
  aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" --lifecycle-configuration '{
    "Rules": [{
      "ID": "limpieza",
      "Status": "Enabled",
      "Filter": {},
      "NoncurrentVersionExpiration": {"NoncurrentDays": 30},
      "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 1}
    }]
  }'

  aws s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration "{
    \"CORSRules\": [{
      \"AllowedOrigins\": [\"https://${DOMAIN}\"],
      \"AllowedMethods\": [\"GET\", \"PUT\"],
      \"AllowedHeaders\": [\"Content-Type\", \"Content-Length\"],
      \"MaxAgeSeconds\": 3600
    }]
  }"
done

echo "==> Usuario IAM $IAM_USER"
aws iam get-user --user-name "$IAM_USER" >/dev/null 2>&1 || aws iam create-user --user-name "$IAM_USER" >/dev/null

aws iam put-user-policy --user-name "$IAM_USER" --policy-name elemental-pro-s3 --policy-document "{
  \"Version\": \"2012-10-17\",
  \"Statement\": [
    {
      \"Effect\": \"Allow\",
      \"Action\": [\"s3:ListBucket\", \"s3:GetBucketLocation\"],
      \"Resource\": [\"arn:aws:s3:::${PHOTOS}\", \"arn:aws:s3:::${PDFS}\"]
    },
    {
      \"Effect\": \"Allow\",
      \"Action\": [\"s3:GetObject\", \"s3:PutObject\", \"s3:DeleteObject\"],
      \"Resource\": [\"arn:aws:s3:::${PHOTOS}/*\", \"arn:aws:s3:::${PDFS}/*\"]
    }
  ]
}"

KEYS=$(aws iam list-access-keys --user-name "$IAM_USER" --query 'length(AccessKeyMetadata)' --output text)
echo
echo "================ Agregar a deploy/lightsail/.env ================"
echo "AWS_REGION=$REGION"
echo "S3_BUCKET_PHOTOS=$PHOTOS"
echo "S3_BUCKET_PDFS=$PDFS"
if [ "$KEYS" = "0" ]; then
  aws iam create-access-key --user-name "$IAM_USER" \
    --query 'AccessKey.[AccessKeyId,SecretAccessKey]' --output text |
    awk '{print "AWS_ACCESS_KEY_ID="$1"\nAWS_SECRET_ACCESS_KEY="$2}'
  echo "================================================================="
  echo "⚠️  La clave secreta se muestra solo esta vez: guardarla en el .env ahora."
else
  echo "(El usuario ya tiene access key: reutilizar la existente o crear una nueva en la consola IAM)"
  echo "================================================================="
fi
