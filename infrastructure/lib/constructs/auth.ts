import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

interface AuthConstructProps {
  stage: string;
  cloudfrontDomain?: string;
  googleClientId?: string;
  googleClientSecret?: string;
}

export class AuthConstruct extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props: AuthConstructProps) {
    super(scope, id);

    const { stage, cloudfrontDomain } = props;

    const accountId = cdk.Stack.of(this).account;

    // User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `elemental-pro-${stage}`,
      selfSignUpEnabled: false,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        fullname: {
          required: false,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy:
        stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Google IdP (if credentials provided)
    const googleClientIdParam = new cdk.CfnParameter(this, 'GoogleClientId', {
      type: 'String',
      description: 'Google OAuth Client ID',
      default: '',
    });

    const googleClientSecretParam = new cdk.CfnParameter(
      this,
      'GoogleClientSecret',
      {
        type: 'String',
        description: 'Google OAuth Client Secret',
        default: '',
        noEcho: true,
      }
    );

    // Add Google as IdP
    const googleProvider = new cognito.UserPoolIdentityProviderGoogle(
      this,
      'GoogleProvider',
      {
        userPool: this.userPool,
        clientId: googleClientIdParam.valueAsString,
        clientSecretValue: cdk.SecretValue.unsafePlainText(
          googleClientSecretParam.valueAsString
        ),
        scopes: ['openid', 'email', 'profile'],
        attributeMapping: {
          email: cognito.ProviderAttribute.GOOGLE_EMAIL,
          fullname: cognito.ProviderAttribute.GOOGLE_NAME,
        },
      }
    );

    // Callback and logout URLs
    const callbackUrls = [
      'http://localhost:5173', // local dev
    ];

    const logoutUrls = [
      'http://localhost:5173/login',
    ];

    if (cloudfrontDomain) {
      callbackUrls.push(`https://${cloudfrontDomain}`);
      logoutUrls.push(`https://${cloudfrontDomain}/login`);
    }

    // User Pool Client (App Client)
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `elemental-pro-web-${stage}`,
      generateSecret: false,
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls,
        logoutUrls,
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
        cognito.UserPoolClientIdentityProvider.GOOGLE,
      ],
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      enableTokenRevocation: true,
    });

    // Make client depend on Google provider
    this.userPoolClient.node.addDependency(googleProvider);

    // Cognito Domain
    this.userPoolDomain = new cognito.UserPoolDomain(this, 'UserPoolDomain', {
      userPool: this.userPool,
      cognitoDomain: {
        domainPrefix: `elemental-pro-${accountId.slice(-8)}`,
      },
    });

    // Create groups
    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'ADMIN',
      description: 'Administrator group',
      precedence: 1,
    });

    new cognito.CfnUserPoolGroup(this, 'TechnicianGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'TECHNICIAN',
      description: 'Technician group',
      precedence: 2,
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'CognitoDomain', {
      value: `${this.userPoolDomain.domainName}.auth.${cdk.Stack.of(this).region}.amazoncognito.com`,
      description: 'Cognito Hosted UI Domain',
    });
  }
}
