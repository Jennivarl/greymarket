f='C:/Users/USER/genlayer-hackathon/frontend/src/components/MarketDetail.tsx'
data=open(f,'rb').read()
try:
    data.decode('utf-8')
    print('VALID')
except Exception as e:
    print('INVALID:',e)
