FROM node:10

WORKDIR /code
COPY . .

# install rsync
RUN apt-get update && apt-get upgrade -y && apt-get install -y rsync

RUN npm install
RUN npm run setup
RUN cd client && npm install
RUN cd server && npm install

EXPOSE 3000
EXPOSE 3210

ENTRYPOINT ["./entrypoint.sh"]