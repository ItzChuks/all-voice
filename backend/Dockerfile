# PocketBase backend for All Voices Society — built and run by Railway.
FROM alpine:3.20

ARG PB_VERSION=0.30.0
RUN apk add --no-cache ca-certificates unzip wget \
 && wget -q https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip -O /tmp/pb.zip \
 && unzip /tmp/pb.zip -d /pb \
 && rm /tmp/pb.zip

# Collections + rules are created from these on first start
COPY pb_migrations /pb/pb_migrations
COPY docker-entrypoint.sh /pb/docker-entrypoint.sh
RUN chmod +x /pb/docker-entrypoint.sh

EXPOSE 8080
CMD ["/pb/docker-entrypoint.sh"]
