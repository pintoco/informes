import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

interface StorageConstructProps {
  stage: string;
  cloudfrontDomain?: string;
}

export class StorageConstruct extends Construct {
  public readonly photosBucket: s3.Bucket;
  public readonly pdfsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageConstructProps) {
    super(scope, id);

    const { stage } = props;

    // Photos bucket
    this.photosBucket = new s3.Bucket(this, 'PhotosBucket', {
      bucketName: `elemental-pro-photos-${stage}-${cdk.Stack.of(this).account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: false,
      removalPolicy:
        stage === 'prod'
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: stage !== 'prod',
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
          ],
          allowedOrigins: ['*'], // Restrict to CloudFront domain in production
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        {
          id: 'archive-old-photos',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(365),
            },
          ],
          expiration: cdk.Duration.days(365 * 7), // 7 years
        },
      ],
    });

    // PDFs bucket
    this.pdfsBucket = new s3.Bucket(this, 'PdfsBucket', {
      bucketName: `elemental-pro-pdfs-${stage}-${cdk.Stack.of(this).account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: false,
      removalPolicy:
        stage === 'prod'
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: stage !== 'prod',
      lifecycleRules: [
        {
          id: 'archive-old-pdfs',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(365),
            },
          ],
          expiration: cdk.Duration.days(365 * 7), // 7 years
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'PhotosBucketName', {
      value: this.photosBucket.bucketName,
      description: 'S3 bucket for service photos',
    });

    new cdk.CfnOutput(this, 'PdfsBucketName', {
      value: this.pdfsBucket.bucketName,
      description: 'S3 bucket for generated PDFs',
    });
  }
}
