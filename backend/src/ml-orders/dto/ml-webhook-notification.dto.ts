import { IsString, MinLength } from 'class-validator';

/**
 * Payload que envía Mercado Libre a la callback URL configurada en el devcenter.
 * Solo se validan los campos que efectivamente se usan (topic y resource); el resto
 * del payload se ignora.
 */
export class MlWebhookNotificationDto {
  @IsString()
  @MinLength(1)
  topic!: string;

  @IsString()
  @MinLength(1)
  resource!: string;
}
