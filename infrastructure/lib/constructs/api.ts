import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';

interface ApiConstructProps {
  stage: string;
  vpc: ec2.Vpc;
  lambdaSecurityGroup: ec2.SecurityGroup;
  dbSecret: secretsmanager.Secret;
  dbEndpoint: string;
  photosBucket: s3.Bucket;
  pdfsBucket: s3.Bucket;
  cognitoUserPoolId: string;
  cognitoRegion: string;
  corsOrigin: string;
}

export class ApiConstruct extends Construct {
  public readonly apiLambda: lambda.Function;
  public readonly pdfWorkerLambda: lambda.Function;
  public readonly api: apigateway.RestApi;
  public readonly pdfQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);

    const {
      stage,
      vpc,
      lambdaSecurityGroup,
      dbSecret,
      dbEndpoint,
      photosBucket,
      pdfsBucket,
      cognitoUserPoolId,
      cognitoRegion,
      corsOrigin,
    } = props;

    const region = cdk.Stack.of(this).region;

    // DLQ for PDF processing
    const pdfDlq = new sqs.Queue(this, 'PdfJobsDlq', {
      queueName: `elemental-pro-pdf-jobs-dlq-${stage}`,
      retentionPeriod: cdk.Duration.days(14),
    });

    // SQS Queue for PDF jobs
    this.pdfQueue = new sqs.Queue(this, 'PdfJobsQueue', {
      queueName: `elemental-pro-pdf-jobs-${stage}`,
      visibilityTimeout: cdk.Duration.minutes(5),
      retentionPeriod: cdk.Duration.days(4),
      deadLetterQueue: {
        queue: pdfDlq,
        maxReceiveCount: 3,
      },
    });

    // Lambda execution role
    const lambdaRole = new iam.Role(this, 'LambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaVPCAccessExecutionRole'
        ),
      ],
    });

    // S3 permissions
    photosBucket.grantReadWrite(lambdaRole);
    pdfsBucket.grantReadWrite(lambdaRole);

    // SQS permissions
    this.pdfQueue.grantSendMessages(lambdaRole);

    // Secrets Manager permissions
    dbSecret.grantRead(lambdaRole);

    // Common environment variables
    const commonEnv = {
      NODE_ENV: 'production',
      AWS_REGION: region,
      COGNITO_REGION: cognitoRegion,
      COGNITO_USER_POOL_ID: cognitoUserPoolId,
      S3_BUCKET_PHOTOS: photosBucket.bucketName,
      S3_BUCKET_PDFS: pdfsBucket.bucketName,
      SQS_PDF_QUEUE_URL: this.pdfQueue.queueUrl,
      CORS_ORIGIN: corsOrigin,
    };

    // API Lambda (NestJS handler)
    this.apiLambda = new lambda.Function(this, 'ApiLambda', {
      functionName: `elemental-pro-api-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'lambda.handler',
      code: lambda.Code.fromAsset('../backend/dist'),
      role: lambdaRole,
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [lambdaSecurityGroup],
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        ...commonEnv,
        DATABASE_URL: `postgresql://postgres:${dbSecret.secretValueFromJson('password').unsafeUnwrap()}@${dbEndpoint}:5432/elemental_pro`,
      },
      layers: [],
    });

    // PDF Worker Lambda (SQS consumer with Puppeteer)
    this.pdfWorkerLambda = new lambda.Function(this, 'PdfWorkerLambda', {
      functionName: `elemental-pro-pdf-worker-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'pdfs/pdf-worker/pdf-worker.service.sqsHandler',
      code: lambda.Code.fromAsset('../backend/dist'),
      role: lambdaRole,
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [lambdaSecurityGroup],
      timeout: cdk.Duration.minutes(5),
      memorySize: 2048, // Puppeteer needs more memory
      environment: {
        ...commonEnv,
        DATABASE_URL: `postgresql://postgres:${dbSecret.secretValueFromJson('password').unsafeUnwrap()}@${dbEndpoint}:5432/elemental_pro`,
      },
      ephemeralStorageSize: cdk.Size.mebibytes(1024),
    });

    // Wire SQS to PDF worker Lambda
    this.pdfWorkerLambda.addEventSource(
      new SqsEventSource(this.pdfQueue, {
        batchSize: 1,
        enabled: true,
      })
    );

    // SQS consume permissions for worker
    this.pdfQueue.grantConsumeMessages(this.pdfWorkerLambda);

    // API Gateway
    this.api = new apigateway.RestApi(this, 'RestApi', {
      restApiName: `elemental-pro-api-${stage}`,
      description: 'Elemental Pro API Gateway',
      deployOptions: {
        stageName: stage,
        metricsEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: stage !== 'prod',
        throttlingRateLimit: 1000,
        throttlingBurstLimit: 2000,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
    });

    // Lambda integration
    const lambdaIntegration = new apigateway.LambdaIntegration(this.apiLambda, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });

    // Proxy all requests to Lambda
    const proxyResource = this.api.root.addResource('{proxy+}');
    proxyResource.addMethod('ANY', lambdaIntegration);
    this.api.root.addMethod('ANY', lambdaIntegration);

    // Outputs
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'PdfQueueUrl', {
      value: this.pdfQueue.queueUrl,
      description: 'SQS PDF Jobs Queue URL',
    });
  }
}
