FROM node:10

WORKDIR /code
COPY . .

RUN npm run setup

EXPOSE 3000
EXPOSE 3210

ENTRYPOINT ["./entrypoint.sh"]