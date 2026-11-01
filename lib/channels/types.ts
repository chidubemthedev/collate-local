export interface ChannelSendInput {
  chatId: string | number;
  text: string;
  okButtonDeliveryId?: string;
}

export interface ChannelSendResult {
  providerMessageId: string;
}

export interface ChannelAdapter {
  send(input: ChannelSendInput): Promise<ChannelSendResult>;
  receive(): Promise<never>;
}
